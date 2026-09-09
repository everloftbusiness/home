import { describe, it, expect } from 'vitest';
import { sumAmounts, minorUnits, csvCell } from './money';
import { bookingSchema } from '../schemas/booking.schema';
describe('booking money', () => {
    it('reconciles the actual June 2 guest and host breakdowns', () => {
        expect(sumAmounts(['2080', '104', '293.65'], 'INR')).toBe('2477.65');
        expect(sumAmounts(['2600', '-520', '-62.40', '-2.08'], 'INR')).toBe('2015.52');
    });
    it('keeps exact decimal arithmetic', () => expect(sumAmounts(['0.1', '0.2', '-0.3'], 'USD')).toBe('0.00'));
    it('respects zero and three decimal currencies', () => {
        expect(sumAmounts(['100', '-1'], 'JPY')).toBe('99');
        expect(() => minorUnits('100.1', 'JPY')).toThrow();
        expect(sumAmounts(['1.001', '0.009'], 'KWD')).toBe('1.010');
        expect(() => minorUnits('1.001', 'INR')).toThrow();
    });
    it('neutralizes spreadsheet formula injection and quotes embedded text', () => {
        expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
        expect(csvCell('Guest, A')).toBe('"Guest, A"');
    });
});
describe('booking validation', () => {
    const valid = { request_id: '11111111-1111-4111-8111-111111111111', property_id: '22222222-2222-4222-8222-222222222222', guest_id: '', guest_name: 'Test guest', email: '', phone: '', country: '', unit_label: '405', source: 'Airbnb', external_booking_ref: '', booking_date: '2026-06-01', check_in_date: '2026-06-02', check_out_date: '2026-06-03', adults: 1, children: 0, currency: 'INR', status: 'confirmed', notes: '', lines: [{ side: 'guest', category: 'accommodation', label: 'Guest', amount: '100' }, { side: 'host', category: 'accommodation', label: 'Host', amount: '90' }] };
    it('accepts a one-night stay', () => expect(bookingSchema.safeParse(valid).success).toBe(true));
    it('rejects impossible dates, checkout before checkin and negative totals', () => {
        expect(bookingSchema.safeParse({ ...valid, check_in_date: '2026-02-30' }).success).toBe(false);
        expect(bookingSchema.safeParse({ ...valid, check_out_date: valid.check_in_date }).success).toBe(false);
        expect(bookingSchema.safeParse({ ...valid, lines: [valid.lines[0], { ...valid.lines[1], amount: '-90' }] }).success).toBe(false);
    });
});
