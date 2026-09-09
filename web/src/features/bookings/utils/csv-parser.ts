import { CATEGORIES } from '../types/booking.types';

export type ParsedImportRow = {
  rawLineIndex: number;
  guestName: string;
  roomLabel: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  contactPhone: string | null;
  currency: string;
  guestBase: number;
  guestTaxes: number;
  guestServiceCharge: number;
  guestTotal: number;
  hostBase: number;
  hostRateAdjustment: number;
  hostServiceFee: number;
  hostTaxes: number;
  hostAdditionalIncome: number;
  hostTotal: number;
  amountCreditedBank: string | null;
  creditedDate: string | null;
  note: string | null;
  isValid: boolean;
  validationError?: string;
  reconciliationNote?: string;
  customFields?: Record<string, string | number>;
};

/**
 * Determines whether a property is an independent pool villa / single-unit property
 */
export function isSingleUnitProperty(propertyName: string | undefined): boolean {
  if (!propertyName) return false;
  const lower = propertyName.toLowerCase();
  return (
    lower.includes('villa') ||
    lower.includes('estate') ||
    lower.includes('bungalow') ||
    lower.includes('cottage') ||
    lower.includes('resorts') ||
    lower.includes('beach house')
  );
}

/**
 * Parses raw CSV text into rows of string arrays, handling escaped quotes and commas.
 */
export function parseCsvText(csvText: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentToken = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentToken += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentToken += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentToken.trim());
        currentToken = '';
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        currentRow.push(currentToken.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
  }

  if (currentToken || currentRow.length > 0) {
    currentRow.push(currentToken.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Normalizes number inputs (e.g., "2,080.00", "₹2080" -> 2080)
 */
export function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Standardizes date strings like "2-Jun-2026", "2026-06-02", "02/06/2026" into YYYY-MM-DD
 */
export function parseDate(val: string | number | undefined): string {
  if (!val) return new Date().toISOString().slice(0, 10);
  const trimmed = String(val).trim();

  // Excel Serial Date Number (e.g. 46175 -> 2026-06-02)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    const dateMs = (serial - 25569) * 86400 * 1000;
    return new Date(dateMs).toISOString().slice(0, 10);
  }

  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD-MMM-YYYY or D-MMM-YYYY (e.g. 2-Jun-2026, 12-Jun-2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const matchDMMMYYYY = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{4})$/);
  if (matchDMMMYYYY) {
    const day = matchDMMMYYYY[1].padStart(2, '0');
    const monthStr = matchDMMMYYYY[2].toLowerCase();
    const month = monthMap[monthStr] || '01';
    const year = matchDMMMYYYY[3];
    return `${year}-${month}-${day}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

export const SYSTEM_MAPPING_FIELDS = [
  { key: 'checkInDate', label: 'Check-in Date' },
  { key: 'guestName', label: 'Guest Name' },
  { key: 'roomLabel', label: 'Room / Unit Reference' },
  { key: 'source', label: 'Channel Source (Site)' },
  { key: 'nights', label: 'Number of Days / Nights' },
  { key: 'guestBase', label: 'Guest Base Fare' },
  { key: 'guestTaxes', label: 'Guest Taxes (GST)' },
  { key: 'guestServiceCharge', label: 'Guest Service Charge' },
  { key: 'guestTotal', label: 'Guest Total Amount' },
  { key: 'hostBase', label: 'Host Base Payout' },
  { key: 'hostRateAdjustment', label: 'Host Rate Adjustment' },
  { key: 'hostServiceFee', label: 'Host Service Fee' },
  { key: 'hostTaxes', label: 'Host Tax / TDS' },
  { key: 'hostAdditionalIncome', label: 'Host Additional Income' },
  { key: 'hostTotal', label: 'Host Total Payout' },
  { key: 'contactPhone', label: 'Contact Phone Number' },
  { key: 'amountCreditedBank', label: 'Amount Credited / Bank Account' },
  { key: 'creditedDate', label: 'Credited Date' },
  { key: 'note', label: 'Note / Remarks' },
  { key: 'ignore', label: '— Ignore Column —' },
] as const;

export type DynamicFieldDefinition = {
  key: string;
  label: string;
  category?: string;
  dataType?: 'text' | 'number' | 'date';
  isDynamic?: boolean;
};

export function getCombinedSystemFields(dynamicFields: DynamicFieldDefinition[] = []) {
  const dynamicMapped = dynamicFields.map((f) => ({
    key: f.key,
    label: `✨ ${f.label} [Dynamic]`,
    isDynamic: true,
    category: f.category || 'Custom Dynamic Fields',
    dataType: f.dataType || 'text',
  }));

  return [...SYSTEM_MAPPING_FIELDS, ...dynamicMapped];
}

export type SystemFieldKey = (typeof SYSTEM_MAPPING_FIELDS)[number]['key'] | string;

/**
 * Detects headers and returns column index -> suggested field key
 */
export function detectHeaderColumns(csvContent: string): {
  headerIndex: number;
  headers: string[];
  suggestedMappings: Record<number, string>;
} {
  const rows = parseCsvText(csvContent);
  if (rows.length < 2) {
    return { headerIndex: 0, headers: [], suggestedMappings: {} };
  }

  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].join(' ').toLowerCase();
    if (
      rowStr.includes('date') &&
      (rowStr.includes('guest name') || rowStr.includes('guest')) &&
      (rowStr.includes('room') || rowStr.includes('unit'))
    ) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowStr = rows[i].join(' ').toLowerCase();
      if (rowStr.includes('guest name') || rowStr.includes('guest')) {
        headerIndex = i;
        break;
      }
    }
  }
  if (headerIndex === -1) headerIndex = 0;

  const headers = rows[headerIndex].map((h) => String(h || '').trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  function findCol(keywords: string[], startIndex = 0): number {
    return lowerHeaders.findIndex((h, idx) => idx >= startIndex && keywords.some((k) => h === k || h.includes(k)));
  }

  const colDate = findCol(['date', 'check-in', 'checkin']);
  const colGuest = findCol(['guest name', 'guest', 'name']);
  const colRoom = findCol(['room', 'unit']);
  const colSite = findCol(['site', 'channel', 'source']);
  const colNights = findCol(['number of days', 'days', 'nights']);

  const colGuestBase = findCol(['base fair', 'base fare', 'guest base']);
  const colGuestTax = findCol(['taxes / percentage', 'taxes', 'gst']);
  const colGuestService = findCol(['services charge / percentage', 'services charge', 'service charge', 'guest fee']);
  const colGuestTotal = findCol(['total amount', 'guest total']);

  const hostSearchStart = colGuestTotal !== -1 ? colGuestTotal + 1 : colGuestBase + 3;
  const colHostBase = findCol(['base fair', 'base fare', 'host base'], hostSearchStart);
  const colHostRateAdj = findCol(['rate adjustment', 'adjustment'], hostSearchStart);
  const colHostServiceFee = findCol(['service fee / percentage', 'service fee', 'commission'], hostSearchStart);
  const colHostAddIncome = findCol(['additional income'], hostSearchStart);
  const colHostTotal = lowerHeaders.findIndex(
    (h, idx) => idx >= hostSearchStart && (h === 'total' || h.includes('payout'))
  );

  const colContact = findCol(['contact', 'phone', 'mobile']);
  const colBank = findCol(['amount credited', 'credited to', 'bank']);
  const colCreditedDate = findCol(['credited date']);
  const colNote = findCol(['note', 'notes']);

  const suggestedMappings: Record<number, string> = {};
  if (colDate !== -1) suggestedMappings[colDate] = 'checkInDate';
  if (colGuest !== -1) suggestedMappings[colGuest] = 'guestName';
  if (colRoom !== -1) suggestedMappings[colRoom] = 'roomLabel';
  if (colSite !== -1) suggestedMappings[colSite] = 'source';
  if (colNights !== -1) suggestedMappings[colNights] = 'nights';
  if (colGuestBase !== -1) suggestedMappings[colGuestBase] = 'guestBase';
  if (colGuestTax !== -1) suggestedMappings[colGuestTax] = 'guestTaxes';
  if (colGuestService !== -1) suggestedMappings[colGuestService] = 'guestServiceCharge';
  if (colGuestTotal !== -1) suggestedMappings[colGuestTotal] = 'guestTotal';
  if (colHostBase !== -1) suggestedMappings[colHostBase] = 'hostBase';
  if (colHostRateAdj !== -1) suggestedMappings[colHostRateAdj] = 'hostRateAdjustment';
  if (colHostServiceFee !== -1) suggestedMappings[colHostServiceFee] = 'hostServiceFee';
  if (colHostAddIncome !== -1) suggestedMappings[colHostAddIncome] = 'hostAdditionalIncome';
  if (colHostTotal !== -1) suggestedMappings[colHostTotal] = 'hostTotal';
  if (colContact !== -1) suggestedMappings[colContact] = 'contactPhone';
  if (colBank !== -1) suggestedMappings[colBank] = 'amountCreditedBank';
  if (colCreditedDate !== -1) suggestedMappings[colCreditedDate] = 'creditedDate';
  if (colNote !== -1) suggestedMappings[colNote] = 'note';

  return { headerIndex, headers, suggestedMappings };
}

/**
 * Converts parsed CSV rows into Everloft Import Objects with optional custom mappings override
 */
export function parseGoogleSheetCsv(
  csvContent: string,
  customMappings?: Record<number, string>,
  dynamicFields: DynamicFieldDefinition[] = []
): ParsedImportRow[] {
  const rows = parseCsvText(csvContent);
  if (rows.length < 2) return [];

  const detected = detectHeaderColumns(csvContent);
  const headerIndex = detected.headerIndex;
  const mappings = customMappings ?? detected.suggestedMappings;
  const knownStandardKeys = new Set<string>(SYSTEM_MAPPING_FIELDS.map((f) => f.key));

  // Invert mapping for fast lookup by field name
  function getColForField(fieldKey: string): number {
    const entry = Object.entries(mappings).find(([, val]) => val === fieldKey);
    return entry ? parseInt(entry[0], 10) : -1;
  }

  const colDate = getColForField('checkInDate');
  const colGuest = getColForField('guestName');
  const colRoom = getColForField('roomLabel');
  const colSite = getColForField('source');
  const colNights = getColForField('nights');

  const colGuestBase = getColForField('guestBase');
  const colGuestTax = getColForField('guestTaxes');
  const colGuestService = getColForField('guestServiceCharge');
  const colGuestTotal = getColForField('guestTotal');

  const colHostBase = getColForField('hostBase');
  const colHostRateAdj = getColForField('hostRateAdjustment');
  const colHostServiceFee = getColForField('hostServiceFee');
  const colHostAddIncome = getColForField('hostAdditionalIncome');
  const colHostTotal = getColForField('hostTotal');

  const colContact = getColForField('contactPhone');
  const colBank = getColForField('amountCreditedBank');
  const colCreditedDate = getColForField('creditedDate');
  const colNote = getColForField('note');

  const parsed: ParsedImportRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2 || !r.some((c) => c.length > 0)) continue;

    const guestName = colGuest !== -1 ? r[colGuest] || 'Guest' : 'Guest';
    let roomLabel = colRoom !== -1 ? r[colRoom] || '' : '';
    const source = colSite !== -1 ? r[colSite] || 'Direct' : 'Direct';
    const nights = Math.max(1, colNights !== -1 ? parseNumber(r[colNights]) || 1 : 1);
    const checkInDate = colDate !== -1 ? parseDate(r[colDate]) : new Date().toISOString().slice(0, 10);

    // Compute check out date based on nights
    const inDate = new Date(checkInDate);
    inDate.setDate(inDate.getDate() + nights);
    const checkOutDate = inDate.toISOString().slice(0, 10);

    let guestBase = colGuestBase !== -1 ? parseNumber(r[colGuestBase]) : 0;
    let guestTaxes = colGuestTax !== -1 ? parseNumber(r[colGuestTax]) : 0;
    const guestServiceCharge = colGuestService !== -1 ? parseNumber(r[colGuestService]) : 0;
    let guestTotal = colGuestTotal !== -1 ? parseNumber(r[colGuestTotal]) : 0;

    const notesList: string[] = [];

    if (!guestTotal && (guestBase || guestTaxes || guestServiceCharge)) {
      guestTotal = guestBase + guestTaxes + guestServiceCharge;
    }

    // Auto-calculate GST 18% split if Total is present but Tax/Base are missing
    if (guestTotal > 0 && !guestBase && !guestTaxes) {
      guestBase = Math.round((guestTotal / 1.18) * 100) / 100;
      guestTaxes = Math.round((guestTotal - guestBase) * 100) / 100;
      notesList.push('Auto-calculated GST (18%) split');
    }

    // Auto-assign 'Whole Villa' for Pool Villas / Independent properties if unit is blank
    if (!roomLabel) {
      roomLabel = 'Whole Villa';
      notesList.push("Auto-assigned unit 'Whole Villa'");
    }

    let hostBase = colHostBase !== -1 ? parseNumber(r[colHostBase]) : guestBase;
    const hostRateAdjustment = colHostRateAdj !== -1 ? parseNumber(r[colHostRateAdj]) : 0;
    const hostServiceFee = colHostServiceFee !== -1 ? parseNumber(r[colHostServiceFee]) : 0;
    const hostAdditionalIncome = colHostAddIncome !== -1 ? parseNumber(r[colHostAddIncome]) : 0;

    let hostTotal = 0;
    if (colHostTotal !== -1 && r[colHostTotal]) {
      hostTotal = parseNumber(r[colHostTotal]);
    } else {
      hostTotal = hostBase + hostRateAdjustment + hostAdditionalIncome - hostServiceFee;
    }

    const contactPhone = colContact !== -1 && r[colContact] ? r[colContact] : null;
    const amountCreditedBank = colBank !== -1 && r[colBank] ? r[colBank] : null;
    const creditedDate = colCreditedDate !== -1 && r[colCreditedDate] ? parseDate(r[colCreditedDate]) : null;
    const note = colNote !== -1 && r[colNote] ? r[colNote] : null;

    const customFieldsMap: Record<string, string | number> = {};
    if (mappings) {
      Object.entries(mappings).forEach(([colStr, fieldKey]) => {
        if (fieldKey && fieldKey !== 'ignore' && !knownStandardKeys.has(fieldKey)) {
          const colIdx = parseInt(colStr, 10);
          if (!isNaN(colIdx) && r[colIdx] !== undefined && r[colIdx] !== '') {
            const rawVal = r[colIdx];
            const fieldDef = dynamicFields.find((df) => df.key === fieldKey);
            if (fieldDef?.dataType === 'number') {
              customFieldsMap[fieldKey] = parseNumber(rawVal);
            } else if (fieldDef?.dataType === 'date') {
              customFieldsMap[fieldKey] = parseDate(rawVal);
            } else {
              customFieldsMap[fieldKey] = rawVal;
            }
          }
        }
      });
    }

    const isValid = guestName.length > 0 && guestTotal > 0;
    const reconciliationNote = notesList.length > 0 ? notesList.join('; ') : undefined;

    parsed.push({
      rawLineIndex: i + 1,
      guestName,
      roomLabel,
      source,
      checkInDate,
      checkOutDate,
      nights,
      contactPhone,
      currency: 'INR',
      guestBase,
      guestTaxes,
      guestServiceCharge,
      guestTotal,
      hostBase,
      hostRateAdjustment,
      hostServiceFee,
      hostTaxes: 0,
      hostAdditionalIncome,
      hostTotal,
      amountCreditedBank,
      creditedDate,
      note,
      isValid,
      validationError: !isValid ? 'Missing guest name or non-zero total' : undefined,
      reconciliationNote,
      customFields: Object.keys(customFieldsMap).length > 0 ? customFieldsMap : undefined,
    });
  }

  return parsed;
}
