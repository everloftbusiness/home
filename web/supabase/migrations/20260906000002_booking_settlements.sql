-- First operational booking/settlement slice. Separate from the legacy SQLite checkout.
-- Financial records are mutated ONLY through atomic, permission-checked RPCs.
insert into public.permissions(key,name,description,category) values
 ('manage_booking_register','Manage booking register','Company-wide guest, booking and settlement records.','finance')
on conflict(key) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.slug in ('super_admin','finance_admin') and p.key='manage_booking_register'
on conflict(role_id,permission_id) do update set deleted_at=null;

create table public.guest_profiles (
 id uuid primary key default gen_random_uuid(), full_name text not null check(length(full_name) between 2 and 200),
 email text, phone text, country text, profile_link_id uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id), deleted_at timestamptz
);
create index guest_profiles_email_idx on public.guest_profiles(lower(email));
create index guest_profiles_phone_idx on public.guest_profiles(phone);

create table public.bookings (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 reservation_code text not null unique default ('EL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 property_id uuid not null references public.properties(id), primary_guest_id uuid not null references public.guest_profiles(id),
 unit_label text, source text not null, external_booking_ref text,
 booking_date date not null, check_in_date date not null, check_out_date date not null,
 nights integer generated always as (check_out_date-check_in_date) stored,
 adults integer not null check(adults>0), children integer not null default 0 check(children>=0),
 currency text not null check(currency in ('INR','USD','EUR','GBP','AED','JPY','KWD')),
 status text not null default 'confirmed' check(status in ('inquiry','confirmed','checked_in','checked_out','cancelled','no_show')),
 financial_status text not null default 'draft' check(financial_status in ('draft','finalized')),
 notes text not null default '', finalized_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id), deleted_at timestamptz,
 check(check_out_date>check_in_date), check(length(source) between 1 and 100), check(length(notes)<=5000)
);
create unique index bookings_external_ref_idx on public.bookings(property_id,lower(source),external_booking_ref)
 where external_booking_ref is not null and deleted_at is null;
create index bookings_property_dates_idx on public.bookings(property_id,check_in_date,check_out_date) where deleted_at is null;
create index bookings_status_idx on public.bookings(status,check_in_date,id);

create table public.booking_financial_lines (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 side text not null check(side in ('guest','host')), category text not null,
 label text not null check(length(label) between 1 and 200),
 amount numeric(15,3) not null check(abs(amount)<=999999999),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) default auth.uid()
);
create index booking_financial_lines_booking_idx on public.booking_financial_lines(booking_id);

-- Cash movement; amounts are not copied into booking payment records.
create table public.transactions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 direction text not null check(direction in ('inbound','outbound')),
 amount numeric(15,3) not null check(amount>0 and amount<=999999999),
 currency text not null, status text not null default 'completed' check(status in ('completed','reversed')),
 payment_method text not null, gateway_reference text, account_label text not null,
 related_entity_type text not null default 'booking', related_entity_id uuid not null references public.bookings(id),
 settled_at date not null, reversal_reason text, reversed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id), updated_by uuid references auth.users(id), deleted_at timestamptz
);
create table public.booking_payments (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 transaction_id uuid not null unique references public.transactions(id),
 payment_type text not null check(payment_type in ('guest_collection','host_payout','deposit')),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) default auth.uid()
);
create index booking_payments_booking_idx on public.booking_payments(booking_id);
create index transactions_entity_idx on public.transactions(related_entity_id,settled_at);

do $$ declare t text; begin
 foreach t in array array['guest_profiles','bookings','booking_financial_lines','transactions','booking_payments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy register_read on public.%I for select to authenticated using (public.authorize(''manage_booking_register''))',t);
  execute format('create trigger audit_record after insert or update or delete on public.%I for each row execute function public.record_audit_log()',t);
 end loop;
 foreach t in array array['guest_profiles','bookings','transactions'] loop
  execute format('create trigger stamp_update before update on public.%I for each row execute function public.set_updated_at()',t);
  execute format('create trigger stamp_actor before insert or update on public.%I for each row execute function public.set_audit_columns()',t);
 end loop;
end $$;

create function public.save_booking_record(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare bid uuid; gid uuid; entry jsonb; curr text; precision_digits integer; existing public.bookings; begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 bid := nullif(payload->>'id','')::uuid;
 curr := payload->>'currency';
 precision_digits := case curr when 'JPY' then 0 when 'KWD' then 3 else 2 end;
 if bid is not null then
  select * into existing from public.bookings where id=bid for update;
  if not found then raise exception 'Booking not found'; end if;
  if existing.financial_status<>'draft' then raise exception 'Finalized booking is locked'; end if;
  if nullif(payload->>'updated_at','')::timestamptz is distinct from existing.updated_at then raise exception 'This booking changed. Reload before saving.'; end if;
  if exists(select 1 from public.booking_payments where booking_id=bid) then raise exception 'Booking has payments'; end if;
  gid := existing.primary_guest_id;
 else
  -- Retry-safe creation, serialized on the request key.
  perform pg_advisory_xact_lock(hashtextextended(payload->>'request_id',0));
  select id into bid from public.bookings where request_id=(payload->>'request_id')::uuid;
  if bid is not null then return bid; end if;
  gid := nullif(payload->>'guest_id','')::uuid;
  if gid is null then
   insert into public.guest_profiles(full_name,email,phone,country)
   values(trim(payload->>'guest_name'),nullif(trim(payload->>'email'),''),nullif(trim(payload->>'phone'),''),nullif(trim(payload->>'country'),'')) returning id into gid;
  elsif not exists(select 1 from public.guest_profiles where id=gid and deleted_at is null) then raise exception 'Guest not found';
  end if;
 end if;
 if not exists(select 1 from public.properties where id=(payload->>'property_id')::uuid and deleted_at is null) then raise exception 'Property not found'; end if;
 if payload->'lines' is null or jsonb_typeof(payload->'lines')<>'array' then raise exception 'Provide guest and host breakdowns'; end if;
 if jsonb_array_length(payload->'lines') not between 2 and 100 then raise exception 'Provide guest and host breakdowns'; end if;
 if not exists(select 1 from jsonb_array_elements(payload->'lines') l where l->>'side'='guest') or
    not exists(select 1 from jsonb_array_elements(payload->'lines') l where l->>'side'='host') then raise exception 'Both financial sides are required'; end if;
 if bid is null then
  insert into public.bookings(request_id,property_id,primary_guest_id,unit_label,source,external_booking_ref,booking_date,check_in_date,check_out_date,adults,children,currency,status,notes)
  values((payload->>'request_id')::uuid,(payload->>'property_id')::uuid,gid,nullif(payload->>'unit_label',''),trim(payload->>'source'),nullif(trim(payload->>'external_booking_ref'),''),(payload->>'booking_date')::date,(payload->>'check_in_date')::date,(payload->>'check_out_date')::date,(payload->>'adults')::int,(payload->>'children')::int,curr,payload->>'status',coalesce(payload->>'notes','')) returning id into bid;
 else
  update public.bookings set property_id=(payload->>'property_id')::uuid,unit_label=nullif(payload->>'unit_label',''),source=trim(payload->>'source'),external_booking_ref=nullif(trim(payload->>'external_booking_ref'),''),booking_date=(payload->>'booking_date')::date,check_in_date=(payload->>'check_in_date')::date,check_out_date=(payload->>'check_out_date')::date,adults=(payload->>'adults')::int,children=(payload->>'children')::int,currency=curr,status=payload->>'status',notes=coalesce(payload->>'notes','') where id=bid;
  delete from public.booking_financial_lines where booking_id=bid;
 end if;
 for entry in select * from jsonb_array_elements(payload->'lines') loop
  if (entry->>'amount')::numeric <> round((entry->>'amount')::numeric,precision_digits) then raise exception 'Invalid currency precision'; end if;
  insert into public.booking_financial_lines(booking_id,side,category,label,amount) values(bid,entry->>'side',entry->>'category',trim(entry->>'label'),(entry->>'amount')::numeric);
 end loop;
 if exists(select 1 from public.booking_financial_lines where booking_id=bid group by side having sum(amount)<0) then raise exception 'Financial totals cannot be negative'; end if;
 return bid;
end $$;

create function public.finalize_booking_record(booking_id uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 update public.bookings set financial_status='finalized',finalized_at=now() where id=booking_id and financial_status='draft';
 if not found then raise exception 'Booking unavailable or already finalized'; end if;
end $$;

create function public.update_booking_stay_status(booking_id uuid,new_status text) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 update public.bookings set status=new_status where id=booking_id and deleted_at is null;
 if not found then raise exception 'Booking not found'; end if;
end $$;

create function public.record_booking_payment(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare b public.bookings; tid uuid; amt numeric; begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 select * into b from public.bookings where id=(payload->>'booking_id')::uuid for update;
 if not found or b.financial_status<>'finalized' then raise exception 'Finalize the breakdown before recording payments'; end if;
 select id into tid from public.transactions where request_id=(payload->>'request_id')::uuid;
 if tid is not null then return tid; end if;
 amt := (payload->>'amount')::numeric;
 if amt<>round(amt,case b.currency when 'JPY' then 0 when 'KWD' then 3 else 2 end) then raise exception 'Invalid currency precision'; end if;
 if length(trim(payload->>'account_label'))<1 or length(trim(payload->>'payment_method'))<1 then raise exception 'Account and payment method required'; end if;
 insert into public.transactions(request_id,direction,amount,currency,payment_method,gateway_reference,account_label,related_entity_id,settled_at)
 values((payload->>'request_id')::uuid,payload->>'direction',amt,b.currency,trim(payload->>'payment_method'),nullif(trim(payload->>'reference'),''),trim(payload->>'account_label'),b.id,(payload->>'settled_at')::date) returning id into tid;
 insert into public.booking_payments(booking_id,transaction_id,payment_type) values(b.id,tid,payload->>'payment_type');
 return tid;
end $$;

create function public.reverse_booking_payment(transaction_id uuid,reason text) returns void
language plpgsql security definer set search_path=public as $$ begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 if length(trim(reason))<5 then raise exception 'Explain the correction'; end if;
 update public.transactions set status='reversed',reversal_reason=trim(reason),reversed_at=now() where id=transaction_id and status='completed';
 if not found then raise exception 'Payment unavailable or already reversed'; end if;
end $$;

-- Security-invoker views retain RLS. All aggregation/sorting happens in Postgres.
create view public.booking_register with (security_invoker=true) as
select b.*,g.full_name guest_name,g.email,g.phone,g.country,p.name property_name,
 coalesce(f.guest_total,0) guest_total,coalesce(f.host_total,0) host_total,
 coalesce(t.guest_received,0) guest_received,coalesce(t.host_received,0) host_received,coalesce(t.deposit_held,0) deposit_held,
 coalesce(f.host_total,0)-coalesce(t.host_received,0) payout_balance
from public.bookings b join public.guest_profiles g on g.id=b.primary_guest_id join public.properties p on p.id=b.property_id
left join lateral (select sum(amount) filter(where side='guest') guest_total,sum(amount) filter(where side='host') host_total from public.booking_financial_lines where booking_id=b.id) f on true
left join lateral (select sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='guest_collection') guest_received,
 sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='host_payout') host_received,
 sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='deposit') deposit_held
 from public.booking_payments bp join public.transactions t on t.id=bp.transaction_id where bp.booking_id=b.id and t.status='completed') t on true
where b.deleted_at is null;

-- Finance staff need property labels for this company-wide register, not write access.
create policy booking_register_properties_read on public.properties for select to authenticated using (public.authorize('manage_booking_register'));
revoke all on function public.save_booking_record(jsonb),public.finalize_booking_record(uuid),public.record_booking_payment(jsonb),public.reverse_booking_payment(uuid,text),public.update_booking_stay_status(uuid,text) from public,anon;
grant execute on function public.save_booking_record(jsonb),public.finalize_booking_record(uuid),public.record_booking_payment(jsonb),public.reverse_booking_payment(uuid,text),public.update_booking_stay_status(uuid,text) to authenticated;
grant select on public.booking_register,public.guest_profiles,public.bookings,public.booking_financial_lines,public.transactions,public.booking_payments to authenticated;
