// Ported from js/sheets.js + js/helpers.js — reads the real, live Everloft Google Sheet
// (public "Anyone with the link: Viewer") via the gviz/tq JSON endpoint. Server-side only
// (avoids the CORS/sign-in issues the original client-side fetch had to work around).

const PINNACLE_SPREADSHEET_ID = "1Q_fEZLHCENn-her2QOSkniZqkP-f6DBe";
const SPREADSHEET_ID = process.env.NEXT_PUBLIC_EVERLOFT_SPREADSHEET_ID || PINNACLE_SPREADSHEET_ID;

export const SHEET_NAMES = [
  "Pinnacle Income",
  "Pinnacle Expenses",
  "Bookings",
  "Assets",
  "Revenue",
  "Expenses",
  "Maintenance",
  "Payouts",
  "Admin_Signups",
  "Notes",
  "New_Assets",
] as const;

export type SheetName = (typeof SHEET_NAMES)[number] | string;
export type SheetRow = Record<string, string | number | boolean | null>;

function buildUrl(sheetName: string, sheetId = SPREADSHEET_ID) {
  return (
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}` +
    `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`
  );
}

function decodeSheetResponse(text: string): { table?: { cols: { label: string; id: string }[]; rows: { c: ({ v: unknown } | null)[] }[] } } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Unexpected sheet payload");
  return JSON.parse(text.slice(start, end + 1));
}

function buildRow(cols: { label: string; id: string }[], row: { c: ({ v: unknown } | null)[] }): SheetRow {
  const result: SheetRow = {};
  cols.forEach((col, index) => {
    const key = (col.label && col.label.trim()) || col.id || `column_${index}`;
    const cell = row.c?.[index];
    result[key] = (cell?.v as string | number | boolean | null) ?? "";
  });
  return result;
}

function parseSheetData(payloadText: string): SheetRow[] {
  const parsed = decodeSheetResponse(payloadText);
  if (!parsed.table) return [];
  return parsed.table.rows.map((row) => buildRow(parsed.table!.cols, row));
}

export async function fetchSheetData(sheetName: SheetName, targetSheetId?: string): Promise<SheetRow[]> {
  const targetId = targetSheetId || SPREADSHEET_ID;
  if (!targetId) {
    throw new Error("Spreadsheet ID is missing.");
  }
  let response: Response;
  try {
    response = await fetch(buildUrl(sheetName, targetId), { cache: "no-store" });
  } catch {
    throw new Error("Network error while contacting Google Sheets.");
  }
  if (!response.ok) {
    throw new Error(`Sheet request failed: ${response.status}`);
  }
  const text = await response.text();
  if (/"status"\s*:\s*"error"/i.test(text)) {
    const match = text.match(/"message"\s*:\s*"([^"]+)"/i);
    throw new Error(match?.[1] || "Google Sheets query returned an error");
  }
  try {
    return parseSheetData(text);
  } catch (error) {
    const body = text.toLowerCase();
    if (body.includes("signin") || body.includes("accounts.google.com")) {
      throw new Error('Google Sheet requires sign-in. Share it to "Anyone with the link" (Viewer).');
    }
    throw error;
  }
}

export function getField(row: SheetRow, keys: string[], fallback: string = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return fallback;
}

export function formatInr(value: number): string {
  if (Number.isNaN(value)) return "INR 0";
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatSheetDate(value: unknown): string {
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value ?? "-") || "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}
