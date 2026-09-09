'use server';

import { revalidatePath } from 'next/cache';
import { getBookingOptions, saveBooking, finalizeBooking, recordPayment } from '../services/bookings.service';
import { bookingSchema, paymentSchema } from '../schemas/booking.schema';
import type { ParsedImportRow } from '../utils/csv-parser';
import type { FinancialLine } from '../types/booking.types';

export async function importBookingsAction(
  rows: ParsedImportRow[],
  defaultPropertyId: string
) {
  if (!rows || rows.length === 0) {
    throw new Error('No valid rows provided for import.');
  }

  const properties = await getBookingOptions();
  let importedCount = 0;
  const errors: string[] = [];

  // Unique Batch ID to prevent duplicate external_booking_ref collisions
  const batchId = crypto.randomUUID().slice(0, 8).toUpperCase();

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r.isValid) continue;

    try {
      // Match Property by unit label or use defaultPropertyId
      const matchedProp = properties.find(
        (p) => p.name.includes(r.roomLabel) || p.id === defaultPropertyId
      ) || properties[0];

      const targetPropertyId = matchedProp ? matchedProp.id : defaultPropertyId;

      const isDirect =
        r.source.toLowerCase().includes('db') ||
        r.source.toLowerCase().includes('direct');

      const lines: FinancialLine[] = [];

      // Guest Lines
      if (r.guestBase > 0) {
        lines.push({ side: 'guest', category: 'accommodation', label: 'Base Fare', amount: r.guestBase.toFixed(2) });
      }
      if (r.guestTaxes > 0) {
        lines.push({ side: 'guest', category: 'tax', label: 'Taxes & GST (18%)', amount: r.guestTaxes.toFixed(2) });
      }
      if (r.guestServiceCharge > 0) {
        lines.push({ side: 'guest', category: 'guest_service_fee', label: 'Services Charge', amount: r.guestServiceCharge.toFixed(2) });
      }
      if (lines.filter((l) => l.side === 'guest').length === 0) {
        lines.push({ side: 'guest', category: 'accommodation', label: 'Total Charge', amount: r.guestTotal.toFixed(2) });
      }

      // Host Lines
      if (r.hostBase > 0) {
        lines.push({ side: 'host', category: 'accommodation', label: 'Host Base Payout', amount: r.hostBase.toFixed(2) });
      }
      if (r.hostRateAdjustment > 0) {
        lines.push({ side: 'host', category: 'rate_adjustment', label: 'Rate Adjustment', amount: r.hostRateAdjustment.toFixed(2) });
      }
      if (r.hostServiceFee > 0) {
        lines.push({ side: 'host', category: 'host_service_fee', label: 'Channel Service Fee', amount: r.hostServiceFee.toFixed(2) });
      }
      if (r.hostAdditionalIncome > 0) {
        lines.push({ side: 'host', category: 'additional_income', label: 'Additional Income', amount: r.hostAdditionalIncome.toFixed(2) });
      }
      if (lines.filter((l) => l.side === 'host').length === 0) {
        lines.push({ side: 'host', category: 'accommodation', label: 'Net Payout', amount: r.hostTotal.toFixed(2) });
      }

      const externalBookingRef = `IMP-${batchId}-${idx + 1}-${r.rawLineIndex}`;

      const bookingPayload = {
        request_id: crypto.randomUUID(),
        property_id: targetPropertyId,
        guest_id: '',
        guest_name: r.guestName,
        phone: r.contactPhone || '',
        email: '',
        country: 'India',
        unit_label: r.roomLabel || '',
        source: r.source || 'Direct',
        external_booking_ref: externalBookingRef,
        booking_date: r.checkInDate,
        check_in_date: r.checkInDate,
        check_out_date: r.checkOutDate,
        adults: 1,
        children: 0,
        currency: 'INR' as const,
        status: 'confirmed' as const,
        collection_mode: isDirect ? ('direct' as const) : ('platform' as const),
        notes: r.note ? `${r.note} (Imported)` : 'Imported from Google Sheet',
        lines: lines.map((l) => ({
          side: l.side,
          category: l.category as any,
          label: l.label,
          amount: l.amount,
        })),
      };

      const validatedInput = bookingSchema.parse(bookingPayload);
      const bookingId = await saveBooking(validatedInput);

      // Record Bank Payment if Credited Bank Info exists
      if (r.amountCreditedBank) {
        const paymentAmount = isDirect ? r.guestTotal : r.hostTotal;
        const paymentPayload = {
          request_id: crypto.randomUUID(),
          booking_id: bookingId,
          payment_type: isDirect ? ('guest_collection' as const) : ('host_payout' as const),
          direction: 'inbound' as const,
          amount: paymentAmount.toFixed(2),
          account_label: r.amountCreditedBank,
          payment_method: 'Bank Transfer',
          reference: r.note || 'Bank Receipt Credit',
          settled_at: r.creditedDate || r.checkInDate,
        };
        const validatedPayment = paymentSchema.parse(paymentPayload);
        await recordPayment(validatedPayment);
      }

      // Finalize financial breakdown
      await finalizeBooking(bookingId);
      importedCount++;
    } catch (err) {
      console.error(`Row ${r.rawLineIndex} import failed:`, err);
      errors.push(`Row ${r.rawLineIndex} (${r.guestName}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  revalidatePath('/dashboard/bookings', 'layout');
  return { success: true, count: importedCount, errors };
}

export async function syncPinnacleSheetAction(defaultPropertyId: string) {
  const { fetchSheetData } = await import('@/lib/dashboard/sheets');
  const { parseGoogleSheetCsv } = await import('../utils/csv-parser');

  try {
    const rawRows = await fetchSheetData('Pinnacle Income', '1Q_fEZLHCENn-her2QOSkniZqkP-f6DBe');
    if (!rawRows || rawRows.length === 0) {
      return { success: false, message: 'No rows found in Pinnacle Income tab.' };
    }

    // Convert raw JSON rows to CSV text for robust header detection & parsing
    const keys = Object.keys(rawRows[0] || {});
    const csvLines = [
      keys.join(','),
      ...rawRows.map((r) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')),
    ];
    const csvContent = csvLines.join('\n');

    const parsedRows = parseGoogleSheetCsv(csvContent);
    const validRows = parsedRows.filter((r) => r.isValid);

    if (validRows.length === 0) {
      return { success: false, message: 'Google Sheet accessible, but no valid booking rows found to sync.' };
    }

    const result = await importBookingsAction(validRows, defaultPropertyId);
    return {
      success: true,
      message: `Successfully synced ${result.count} rows live from Google Sheet 'Pinnacle Income'!`,
      count: result.count,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('sign-in') || msg.includes('Anyone with the link')) {
      return {
        success: false,
        requiresPermission: true,
        message: 'Google Sheet is currently restricted. Please update Google Drive permission to "Anyone with the link can view".',
      };
    }
    return { success: false, message: `Sync failed: ${msg}` };
  }
}

