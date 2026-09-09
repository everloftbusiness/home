'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { finalizeBookingAction, recordPaymentAction, reversePaymentAction, updateStayStatusAction } from '../actions/booking.actions';
import { paymentSchema, validatePaymentPrecision } from '../schemas/booking.schema';
import { STATUSES, type BookingRow, type PaymentRow } from '../types/booking.types';
import { money } from '../utils/money';
import { DynamicDropdown } from './dynamic-dropdown';

export function BookingPayments({ booking, payments }: {
    booking: BookingRow;
    payments: PaymentRow[];
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const [review, setReview] = useState(false);
    const [reverseId, setReverseId] = useState('');
    const [reason, setReason] = useState('');
    async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try {
        await fn();
        router.refresh();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
    }
    finally {
        setBusy(false);
    } }
    async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const payload = { ...Object.fromEntries(new FormData(form)), request_id: requestId, booking_id: booking.id }; await run(async () => { const input = paymentSchema.parse(payload); validatePaymentPrecision(input.amount, booking.currency); await recordPaymentAction(input); setRequestId(crypto.randomUUID()); form.reset(); }); }
    return <section className="space-y-5 rounded-lg border bg-card p-5"><h2 className="font-semibold">Receipts, refunds & deposits</h2>
  <label className="flex flex-wrap items-center gap-3 text-sm">Stay status<select className="h-10 rounded border bg-background px-3" value={booking.status} disabled={busy} onChange={e => run(() => updateStayStatusAction(booking.id, e.target.value))}>{STATUSES.map(s => <option value={s} key={s}>{s.replaceAll('_', ' ')}</option>)}</select><span className="text-xs text-muted-foreground">Changing stay status does not change charges or issue refunds.</span></label>
  {booking.financial_status === 'draft' ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Finalize after checking both totals against the source statement. This locks the booking and financial breakdown. Payments can then be recorded; corrections to payments retain their history.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={review} onChange={e => setReview(e.target.checked)}/>I have reviewed this booking and its financial breakdown.</label><Button variant="blue-accent" disabled={!review || busy} onClick={() => run(() => finalizeBookingAction(booking.id))}>Finalize breakdown</Button></div> : <form onSubmit={submit} className="space-y-3">
   <p className="text-sm text-muted-foreground">Guest collection records money collected directly by Everloft. For an OTA bank credit, choose Host payout only. Refundable deposits stay separate from income. All entries use {booking.currency}.</p>
   <div className="grid gap-3 md:grid-cols-3">
    <label className="grid gap-1 text-sm">Receipt type<select className="h-10 rounded border bg-background px-2" name="payment_type" defaultValue={booking.collection_mode==='direct'?'guest_collection':'host_payout'}><option value="host_payout">Host payout</option><option value="guest_collection">Guest collection (direct)</option><option value="deposit">Refundable deposit</option></select></label>
    <label className="grid gap-1 text-sm">Direction<select className="h-10 rounded border bg-background px-2" name="direction"><option value="inbound">Received</option><option value="outbound">Refunded / returned</option></select></label>
    <label className="grid gap-1 text-sm">Amount ({booking.currency})<Input name="amount" inputMode="decimal" required/></label>
    <label className="grid gap-1 text-sm">Received / refunded date<Input name="settled_at" type="date" required/></label>
    <DynamicDropdown
      name="account_label"
      label="Bank account / credited to *"
      defaultValue="EVERLOFT - KGB"
      defaultOptions={['EVERLOFT - KGB', 'EVERLOFT - YES Bank', 'EVERLOFT - HDFC', 'Akhil', 'Nikhil', 'Jithin']}
      placeholder="Select or add bank account..."
      storageKey="bank_accounts"
      required
    />
    <label className="grid gap-1 text-sm">Method<Input name="payment_method" placeholder="Bank transfer, UPI, cash…" required/></label>
    <label className="grid gap-1 text-sm">Bank / platform reference<Input name="reference"/></label>
   </div><Button variant="blue-accent" disabled={busy}>Record payment</Button>
  </form>}
  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground">{['Date', 'Type', 'Account / method', 'Reference', 'Amount', 'Status', 'Correction'].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{payments.map(p => <tr key={p.id} className="border-b"><td className="whitespace-nowrap p-3">{p.settled_at}</td><td className="p-3">{p.payment_type.replaceAll('_', ' ')}</td><td className="p-3">{p.account_label}<div className="text-xs text-muted-foreground">{p.payment_method}</div></td><td className="p-3">{p.gateway_reference || '—'}</td><td className="whitespace-nowrap p-3 tabular-nums">{p.direction === 'outbound' ? '−' : ''}{money(p.amount, p.currency)}</td><td className="p-3">{p.status}<div className="text-xs">{p.reversal_reason}</div></td><td className="p-3">{p.status === 'completed' && <button className="underline" onClick={() => setReverseId(p.id)}>Reverse entry</button>}</td></tr>)}</tbody></table>{!payments.length && <p className="p-5 text-sm text-muted-foreground">No payments recorded.</p>}</div>
  {reverseId && <div className="space-y-2 rounded border p-3"><p className="text-sm">Reverse an incorrect entry. This does not send money or issue a bank refund.</p><Input aria-label="Reason for reversal" value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the correction (at least 5 characters)"/><div className="flex gap-2"><Button disabled={busy || reason.trim().length < 5} onClick={() => run(async () => { await reversePaymentAction(reverseId, reason); setReverseId(''); setReason(''); })}>Confirm reversal</Button><Button variant="outline" onClick={() => setReverseId('')}>Cancel</Button></div></div>}
  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
 </section>;
}
