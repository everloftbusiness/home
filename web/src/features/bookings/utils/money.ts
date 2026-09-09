export function currencyDigits(currency: string) { return currency === 'JPY' ? 0 : currency === 'KWD' ? 3 : 2; }
// Decimal parsing avoids binary floating-point arithmetic in previews.
export function minorUnits(value: string, currency: string): bigint {
    const digits = currencyDigits(currency);
    if (!/^-?\d+(\.\d+)?$/.test(value))
        throw new Error('Enter a valid amount.');
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    if (fraction.length > digits)
        throw new Error(`${currency} allows ${digits} decimal places.`);
    const amount = BigInt(whole) * BigInt(10 ** digits) + BigInt(fraction.padEnd(digits, '0') || '0');
    return value.startsWith('-') ? -amount : amount;
}
export function sumAmounts(values: string[], currency: string) {
    const units = values.reduce((sum, value) => sum + minorUnits(value, currency), BigInt(0));
    const digits = currencyDigits(currency);
    const negative = units < BigInt(0);
    const absolute = (negative ? -units : units).toString().padStart(digits + 1, '0');
    return `${negative ? '-' : ''}${digits ? absolute.slice(0, -digits) + '.' + absolute.slice(-digits) : absolute}`;
}
export function money(value: string | number, currency: string) {
    return new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: currencyDigits(currency), maximumFractionDigits: currencyDigits(currency) }).format(Number(value));
}
export function csvCell(value: unknown) {
    let text = String(value ?? '');
    // Prevent spreadsheet formula execution in exported user-entered values.
    if (/^[\s]*[=+@-]/.test(text))
        text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}
