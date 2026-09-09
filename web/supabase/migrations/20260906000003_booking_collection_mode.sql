alter table public.bookings add column collection_mode text not null default 'platform' check(collection_mode in ('platform','direct'));

-- Preserve the atomic v1 writer; a wrapper adds explicit collection responsibility.
alter function public.save_booking_record(jsonb) rename to save_booking_record_v1;
revoke all on function public.save_booking_record_v1(jsonb) from public,anon,authenticated;
create function public.save_booking_record(payload jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare bid uuid; mode text; begin
 if not public.authorize('manage_booking_register') then raise exception 'Permission denied'; end if;
 mode:=coalesce(payload->>'collection_mode','platform');
 if mode not in ('platform','direct') then raise exception 'Invalid collection mode'; end if;
 if nullif(payload->>'id','') is null then
  perform pg_advisory_xact_lock(hashtextextended(payload->>'request_id',0));
  select id into bid from public.bookings where request_id=(payload->>'request_id')::uuid;
  if bid is not null then return bid; end if;
 end if;
 bid:=public.save_booking_record_v1(payload);
 update public.bookings set collection_mode=mode where id=bid;
 return bid;
end $$;
revoke all on function public.save_booking_record(jsonb) from public,anon;
grant execute on function public.save_booking_record(jsonb) to authenticated;

-- Recreate to include collection_mode without relying on column position changes.
drop view public.booking_register;
create view public.booking_register with (security_invoker=true) as
select b.*,g.full_name guest_name,g.email,g.phone,g.country,p.name property_name,
 coalesce(f.guest_total,0) guest_total,coalesce(f.host_total,0) host_total,
 coalesce(t.guest_received,0) guest_received,coalesce(t.host_received,0) host_received,coalesce(t.deposit_held,0) deposit_held,
 case when b.collection_mode='platform' then coalesce(f.host_total,0)-coalesce(t.host_received,0) else 0 end payout_balance,
 case when b.collection_mode='direct' then coalesce(f.guest_total,0)-coalesce(t.guest_received,0) else null end guest_balance
from public.bookings b join public.guest_profiles g on g.id=b.primary_guest_id join public.properties p on p.id=b.property_id
left join lateral (select sum(amount) filter(where side='guest') guest_total,sum(amount) filter(where side='host') host_total from public.booking_financial_lines where booking_id=b.id) f on true
left join lateral (select sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='guest_collection') guest_received,
 sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='host_payout') host_received,
 sum(case when t.direction='inbound' then t.amount else -t.amount end) filter(where bp.payment_type='deposit') deposit_held
 from public.booking_payments bp join public.transactions t on t.id=bp.transaction_id where bp.booking_id=b.id and t.status='completed') t on true
where b.deleted_at is null;
grant select on public.booking_register to authenticated;
