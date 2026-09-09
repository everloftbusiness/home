import { z } from 'zod';
import { CURRENCIES, STATUSES, CATEGORIES } from '../types/booking.types';
import { minorUnits, sumAmounts } from '../utils/money';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v; }, 'Invalid date');
const amount = z.string().regex(/^-?\d{1,9}(\.\d{1,3})?$/, 'Enter an amount with up to 3 decimal places.').refine(v => Math.abs(Number(v)) <= 999999999);
export const bookingSchema = z.object({
    id: z.string().uuid().optional(), updated_at: z.string().optional(), request_id: z.string().uuid(), property_id: z.string().uuid('Select a property.'),
    guest_id: z.string().uuid().or(z.literal('')), guest_name: z.string().trim().max(200),
    email: z.string().trim().email().or(z.literal('')), phone: z.string().trim().max(40), country: z.string().trim().max(100),
    unit_label: z.string().trim().max(100), source: z.string().trim().min(1).max(100), external_booking_ref: z.string().trim().max(150),
    booking_date: date, check_in_date: date, check_out_date: date, adults: z.coerce.number().int().min(1).max(1000), children: z.coerce.number().int().min(0).max(1000),
    currency: z.enum(CURRENCIES), status: z.enum(STATUSES), notes: z.string().max(5000),
    collection_mode:z.enum(['platform','direct']).default('platform'),
    lines: z.array(z.object({ side: z.enum(['guest', 'host']), category: z.enum(CATEGORIES), label: z.string().trim().min(1).max(200), amount })).min(2).max(100),
}).superRefine((v, ctx) => {
    if (!v.guest_id && !v.id && v.guest_name.length < 2)
        ctx.addIssue({ code: 'custom', path: ['guest_name'], message: 'Enter the guest name.' });
    if (v.check_out_date <= v.check_in_date)
        ctx.addIssue({ code: 'custom', path: ['check_out_date'], message: 'Checkout must follow check-in.' });
    for (const side of ['guest', 'host']) {
        const lines = v.lines.filter(l => l.side === side);
        try {
            if (!lines.length || Number(sumAmounts(lines.map(l => l.amount), v.currency)) < 0)
                throw new Error('Both breakdowns need a non-negative total.');
        }
        catch (e) {
            ctx.addIssue({ code: 'custom', path: ['lines'], message: e instanceof Error ? e.message : 'Invalid breakdown' });
        }
    }
});
export const paymentSchema = z.object({
    request_id: z.string().uuid(), booking_id: z.string().uuid(), payment_type: z.enum(['guest_collection', 'host_payout', 'deposit']),
    direction: z.enum(['inbound', 'outbound']), amount: amount.refine(v => Number(v) > 0, 'Amount must be positive.'),
    account_label: z.string().trim().min(1).max(200), payment_method: z.string().trim().min(1).max(100), reference: z.string().trim().max(200), settled_at: date,
});
export function validatePaymentPrecision(amount: string, currency: string) { minorUnits(amount, currency); }
export type BookingInput = z.infer<typeof bookingSchema>;
