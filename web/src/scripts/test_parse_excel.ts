import fs from 'fs';
import * as xlsx from 'xlsx';
import { parseGoogleSheetCsv } from '../features/bookings/utils/csv-parser';

const wb = xlsx.readFile('D:/Untitled spreadsheet.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const csvText = xlsx.utils.sheet_to_csv(sheet);

const parsed = parseGoogleSheetCsv(csvText);

console.log(`=== PARSED ${parsed.length} ROWS FROM D:\\Untitled spreadsheet.xlsx ===\n`);

console.log('SAMPLE PARSED ROWS (FIRST 10 ROWS):\n');
parsed.slice(0, 10).forEach((r, idx) => {
  console.log(`Row #${r.rawLineIndex}: ${r.guestName} | Room ${r.roomLabel} | ${r.source} | Check-in: ${r.checkInDate} (${r.nights}n)`);
  console.log(`  Guest Total: ₹${r.guestTotal} (Base: ₹${r.guestBase}, Tax: ₹${r.guestTaxes}, Service: ₹${r.guestServiceCharge})`);
  console.log(`  Host Net Payout: ₹${r.hostTotal} (Base: ₹${r.hostBase}, Adj: ₹${r.hostRateAdjustment}, Fee: ₹${r.hostServiceFee})`);
  console.log(`  Bank Payout: ${r.amountCreditedBank || '—'} | Status: ${r.isValid ? 'VALID' : 'INVALID'}`);
  if (r.reconciliationNote) console.log(`  ⚡ Reconciliation Note: ${r.reconciliationNote}`);
  console.log('----------------------------------------------------------------------');
});
