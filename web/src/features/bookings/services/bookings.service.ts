import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getDashboardSession } from '@/lib/dashboard/session';
import { SORT_FIELDS, type BookingRow, type FinancialLine, type GuestOption, type PropertyOption, type RegisterFilters, type PaymentRow } from '../types/booking.types';
import type { BookingInput } from '../schemas/booking.schema';
type Table<T> = {
    Row: T;
    Insert: Partial<T>;
    Update: Partial<T>;
    Relationships: [
    ];
};
type RegisterDatabase = {
    public: {
        Tables: {
            properties: Table<PropertyOption & {
                deleted_at: string | null;
            }>;
            guest_profiles: Table<GuestOption & {
                deleted_at: string | null;
            }>;
            booking_financial_lines: Table<FinancialLine & {
                booking_id: string;
                created_at: string;
            }>;
            transactions: Table<Omit<PaymentRow, 'payment_type'> & {
                related_entity_id: string;
            }>;
            booking_payments: Table<{
                booking_id: string;
                transaction_id: string;
                payment_type: string;
            }>;
        };
        Views: {
            booking_register: {
                Row: BookingRow;
                Relationships: [
                ];
            };
        };
        Functions: {
            update_booking_stay_status: {
                Args: {
                    booking_id: string;
                    new_status: string;
                };
                Returns: undefined;
            };
            save_booking_record: {
                Args: {
                    payload: unknown;
                };
                Returns: string;
            };
            finalize_booking_record: {
                Args: {
                    booking_id: string;
                };
                Returns: undefined;
            };
            record_booking_payment: {
                Args: {
                    payload: unknown;
                };
                Returns: string;
            };
            reverse_booking_payment: {
                Args: {
                    transaction_id: string;
                    reason: string;
                };
                Returns: undefined;
            };
        };
    };
};
async function client() { return await createClient() as unknown as SupabaseClient<RegisterDatabase>; }
export async function requireRegisterAccess() {
    const session = await getDashboardSession();
    if (!session?.permissions.includes('manage_booking_register'))
        throw new Error('Booking register access is restricted to authorized finance staff.');
    return session;
}
function fail(error: {
    message: string;
    code?: string;
} | null) { if (error) {
    if (error.code === '23505')
        throw new Error('This reservation reference already exists for the property and channel.');
    throw new Error(error.message);
} }
export async function getBookingOptions() {
    await requireRegisterAccess();
    const db = await client();
    const { data, error } = await db.from('properties').select('id,name').is('deleted_at', null).order('name').limit(1000);
    fail(error);
    return data ?? [];
}
export async function searchGuests(search: string) {
    await requireRegisterAccess();
    const db = await client();
    const term = search.replace(/[%_,().]/g, ' ').trim().slice(0, 100);
    if (term.length < 2)
        return [];
    const { data, error } = await db.from('guest_profiles').select('id,full_name,email,phone').is('deleted_at', null).or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).order('full_name').limit(20);
    fail(error);
    return data ?? [];
}
export async function listBookings(filters: RegisterFilters, exportRows = false) {
    await requireRegisterAccess();
    const db = await client();
    const page = Math.max(1, Math.min(100000, Number.parseInt(filters.page ?? '1') || 1));
    const size = exportRows ? 1000 : 25;
    let query = db.from('booking_register').select('*', { count: 'exact' });
    if (filters.property && /^[0-9a-f-]{36}$/i.test(filters.property))
        query = query.eq('property_id', filters.property);
    if (filters.status)
        query = query.eq('status', filters.status);
    if (filters.financial)
        query = query.eq('financial_status', filters.financial);
    if (filters.currency)
        query = query.eq('currency', filters.currency);
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from))
        query = query.gte('check_in_date', filters.from);
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to))
        query = query.lte('check_in_date', filters.to);
    if (filters.outstanding === 'yes')
        query = query.or('payout_balance.gt.0,guest_balance.gt.0').eq('financial_status', 'finalized');
    const term = (filters.q ?? '').replace(/[%_,().]/g, ' ').trim().slice(0, 100);
    if (term)
        query = query.or(`guest_name.ilike.%${term}%,reservation_code.ilike.%${term}%,phone.ilike.%${term}%,external_booking_ref.ilike.%${term}%,source.ilike.%${term}%`);
    const sort = SORT_FIELDS.find(s => s === filters.sort) ?? 'check_in_date';
    query = query.order(sort, { ascending: filters.direction === 'asc', nullsFirst: false }).order('id');
    const { data, error, count } = await query.range(exportRows ? 0 : (page - 1) * size, exportRows ? size - 1 : page * size - 1);
    fail(error);
    return { rows: data ?? [], total: count ?? 0, page };
}
export async function getBooking(id: string) {
    await requireRegisterAccess();
    const db = await client();
    const { data: booking, error } = await db.from('booking_register').select('*').eq('id', id).maybeSingle();
    fail(error);
    if (!booking)
        return null;
    const [lines, payments, links] = await Promise.all([
        db.from('booking_financial_lines').select('*').eq('booking_id', id).order('created_at'),
        db.from('transactions').select('*').eq('related_entity_id', id).order('created_at', { ascending: false }),
        db.from('booking_payments').select('*').eq('booking_id', id),
    ]);
    fail(lines.error);
    fail(payments.error);
    fail(links.error);
    return { booking, lines: (lines.data ?? []).map(l => ({ ...l, amount: String(l.amount) })), payments: (payments.data ?? []).map(p => ({ ...p, payment_type: links.data?.find(l => l.transaction_id === p.id)?.payment_type ?? '' })) };
}
export async function saveBooking(input: BookingInput) { await requireRegisterAccess(); const db = await client(); const { data, error } = await db.rpc('save_booking_record', { payload: input }); fail(error); return data!; }
export async function finalizeBooking(id: string) { await requireRegisterAccess(); const db = await client(); const { error } = await db.rpc('finalize_booking_record', { booking_id: id }); fail(error); }
export async function recordPayment(payload: unknown) { await requireRegisterAccess(); const db = await client(); const { error } = await db.rpc('record_booking_payment', { payload }); fail(error); }
export async function reversePayment(id: string, reason: string) { await requireRegisterAccess(); const db = await client(); const { error } = await db.rpc('reverse_booking_payment', { transaction_id: id, reason }); fail(error); }
export async function updateStayStatus(id: string, status: string) { await requireRegisterAccess(); const db = await client(); const { error } = await db.rpc('update_booking_stay_status', { booking_id: id, new_status: status }); fail(error); }
