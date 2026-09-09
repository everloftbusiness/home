import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BookingRegister } from './booking-register';
import { BookingPayments } from './booking-payments';
import type { BookingRow } from '../types/booking.types';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../actions/booking.actions', () => ({ finalizeBookingAction: vi.fn(), recordPaymentAction: vi.fn(), reversePaymentAction: vi.fn(), updateStayStatusAction: vi.fn(), getBookingDetailsAction: vi.fn() }));
vi.mock('../actions/import.actions', () => ({ importBookingsAction: vi.fn() }));
afterEach(cleanup);
const booking = { id: 'test', reservation_code: 'EL-TEST', property_id: 'p1', property_name: 'Example', primary_guest_id: 'g1', guest_name: 'Example guest', email: null, phone: null, country: null, unit_label: '405', source: 'Airbnb', external_booking_ref: 'OTA1', booking_date: '2026-06-01', check_in_date: '2026-06-02', check_out_date: '2026-06-03', nights: 1, adults: 1, children: 0, currency: 'INR', status: 'confirmed', financial_status: 'draft', collection_mode:'platform',guest_balance:null, guest_total: 2477.65, host_total: 2015.52, guest_received: 0, host_received: 0, deposit_held: 0, payout_balance: 2015.52, notes: '', created_at: '2026-06-01', updated_at: '2026-06-01', finalized_at: null } satisfies BookingRow;
describe('booking workflows', () => {
    it('keeps sorting server-addressable and exposes additional fields', () => {
        render(<BookingRegister rows={[booking]} total={1} page={1} filters={{ property: 'p1' }} properties={[{ id: 'p1', name: 'Example' }]}/>);
        expect(screen.getByRole('link', { name: 'Expected payout' })).toHaveAttribute('href', expect.stringContaining('sort=host_total'));
        expect(screen.getByRole('link', { name: 'Example guest' })).toHaveAttribute('href', '/dashboard/bookings/test');
        fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
        fireEvent.click(screen.getByLabelText('Phone'));
        expect(screen.getByRole('columnheader', { name: 'Phone' })).toBeInTheDocument();
    });
    it('requires explicit review before finalizing and hides receipts until finalized', () => {
        render(<BookingPayments booking={booking} payments={[]}/>);
        expect(screen.getByRole('button', { name: 'Finalize breakdown' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('button', { name: 'Finalize breakdown' })).toBeEnabled();
    });
});
