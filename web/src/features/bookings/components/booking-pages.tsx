import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking, getBookingOptions, listBookings } from '../services/bookings.service';
import { BookingRegister } from './booking-register';
import { BookingForm } from './booking-form';
import { BookingPayments } from './booking-payments';
import type { RegisterFilters } from '../types/booking.types';
import { money } from '../utils/money';
export async function RegisterPage({ filters }: {
    filters: RegisterFilters;
}) {
    const [data, properties] = await Promise.all([listBookings(filters), getBookingOptions()]);
    return <BookingRegister {...data} filters={filters} properties={properties}/>;
}
export async function NewBookingPage({ propertyId }: {
    propertyId?: string;
}) {
    const properties = await getBookingOptions();
    return (
        <div className="space-y-6">
            <div>
                <Link href="/dashboard/bookings" className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mb-1">
                    ← Back to Bookings & Settlements
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Add New Booking</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Record a guest stay, property unit assignment, and itemized dual-ledger financials.</p>
            </div>
            <BookingForm properties={properties} propertyId={propertyId}/>
        </div>
    );
}
export async function BookingDetailPage({ id, edit }: {
    id: string;
    edit?: boolean;
}) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
        notFound();
    const data = await getBooking(id);
    if (!data)
        notFound();
    const { booking: b, lines, payments } = data;
    if (edit && b.financial_status === 'draft')
        return <div className="space-y-5"><Link className="text-sm text-blue-600" href={`/dashboard/bookings/${id}`}>← Booking details</Link><h1 className="text-2xl font-semibold">Edit {b.reservation_code}</h1><BookingForm properties={await getBookingOptions()} booking={b} initialLines={lines}/></div>;
    return <div className="space-y-6"><Link className="text-sm text-blue-600" href="/dashboard/bookings">← Bookings & Settlements</Link>
  <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">{b.guest_name}</h1><p className="mt-1 text-sm text-muted-foreground">{b.reservation_code} · {b.financial_status} · {b.status.replaceAll('_', ' ')}</p></div>{b.financial_status === 'draft' && <Link className="rounded-md border px-4 py-2 text-sm" href={`/dashboard/bookings/${id}?edit=1`}>Edit draft</Link>}</div>
  <section className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">{[
            ['Property', b.property_name], ['Room / unit', b.unit_label || '—'], ['Check-in / out', `${b.check_in_date} → ${b.check_out_date}`], ['Guests', `${b.adults} adults · ${b.children} children`], ['Channel', b.source], ['Channel reference', b.external_booking_ref || '—'], ['Contact', b.email || b.phone || 'Not recorded'], ['Nights', String(b.nights)],
        ].map(([k, v]) => <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-sm font-medium">{v}</p></div>)}</section>
  <div className="grid gap-4 md:grid-cols-3">{(b.collection_mode==='direct' ? [['Guest charges',b.guest_total],['Direct collections',b.guest_received],['Guest balance',b.guest_balance??0]] : [['Expected host payout', b.host_total], ['Host payout received', b.host_received], ['Payout difference', b.payout_balance]]).map(([label, value]) => <div className="rounded-lg border bg-card p-5" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(value, b.currency)}</p></div>)}</div>
  <div className="grid gap-5 md:grid-cols-2">{(['guest', 'host'] as const).map(side => <section className="rounded-lg border bg-card p-5" key={side}><h2 className="mb-4 font-semibold">{side === 'guest' ? 'Guest charge breakdown' : 'Host payout breakdown'}</h2>{lines.filter(l => l.side === side).map((l, i) => <div className="flex justify-between gap-4 border-b py-3 text-sm" key={i}><div>{l.label}<p className="text-xs text-muted-foreground">{l.category.replaceAll('_', ' ')}</p></div><span className="tabular-nums">{money(l.amount, b.currency)}</span></div>)}<div className="mt-4 flex justify-between font-semibold"><span>Total ({b.currency})</span><span>{money(side === 'guest' ? b.guest_total : b.host_total, b.currency)}</span></div></section>)}</div>
  <p className="text-sm text-muted-foreground">Direct guest collections: {money(b.guest_received, b.currency)} · Refundable deposit held: {money(b.deposit_held, b.currency)}. Neither is included in host payout receipts.</p>
  {b.notes && <section className="rounded-lg border p-5"><h2 className="font-semibold">Internal notes</h2><p className="mt-2 whitespace-pre-wrap text-sm">{b.notes}</p></section>}
  <BookingPayments booking={b} payments={payments}/>
  <p className="text-xs text-muted-foreground">Created {b.created_at.slice(0, 10)}{b.finalized_at ? ` · Breakdown finalized ${b.finalized_at.slice(0, 10)}` : ''}. This register tracks booking settlements; it is not a company balance sheet or a bank-reconciled statement.</p>
 </div>;
}
