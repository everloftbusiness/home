import { describe, it, expect } from 'vitest';
import {
  parseGoogleSheetCsv,
  parseDate,
  parseNumber,
  isSingleUnitProperty,
  detectHeaderColumns,
  getCombinedSystemFields,
  type DynamicFieldDefinition,
} from './csv-parser';

describe('CSV Parser for Google Sheet Import', () => {
  it('correctly parses dates and numbers', () => {
    expect(parseDate('2-Jun-2026')).toBe('2026-06-02');
    expect(parseDate('12-Jun-2026')).toBe('2026-06-12');
    expect(parseNumber('2,080.00')).toBe(2080);
    expect(parseNumber('4974.36')).toBe(4974.36);
  });

  it('correctly classifies single unit pool villas vs multi-unit properties', () => {
    expect(isSingleUnitProperty('Villa Zephyr (Pool Villa)')).toBe(true);
    expect(isSingleUnitProperty('Serenity Estate Bungalow')).toBe(true);
    expect(isSingleUnitProperty('Everloft Executive Lofts')).toBe(false);
    expect(isSingleUnitProperty('City Center Apartment 405')).toBe(false);
  });

  it('detects header columns and supports custom user column mappings override', () => {
    const csvContent = `Stay Date,Customer Name,Unit No,Total Fare\n2026-06-10,Rohan Mehta,501,15000`;
    const detected = detectHeaderColumns(csvContent);

    expect(detected.headers).toContain('Stay Date');
    expect(detected.headers).toContain('Customer Name');

    // Override mappings dynamically from UI
    const customMappings: Record<number, string> = {
      0: 'checkInDate',
      1: 'guestName',
      2: 'roomLabel',
      3: 'guestTotal',
    };

    const parsed = parseGoogleSheetCsv(csvContent, customMappings);
    expect(parsed.length).toBe(1);
    expect(parsed[0].guestName).toBe('Rohan Mehta');
    expect(parsed[0].roomLabel).toBe('501');
    expect(parsed[0].guestTotal).toBe(15000);
    expect(parsed[0].checkInDate).toBe('2026-06-10');
  });

  it('supports dynamically creating new custom system fields and extracting custom values', () => {
    const dynamicFields: DynamicFieldDefinition[] = [
      { key: 'custom_airport_pickup', label: 'Airport Pickup Fee', dataType: 'number', isDynamic: true },
      { key: 'custom_driver_note', label: 'Driver Instructions', dataType: 'text', isDynamic: true },
    ];

    const combined = getCombinedSystemFields(dynamicFields);
    expect(combined.some((f) => f.key === 'custom_airport_pickup')).toBe(true);

    const csvContent = `Date,Guest name,Total Amount,Airport Pickup Fee,Driver Instructions\n5-Jun-2026,Anand V,11800,1500,Meet at Terminal 2 gate 4`;
    const customMappings: Record<number, string> = {
      0: 'checkInDate',
      1: 'guestName',
      2: 'guestTotal',
      3: 'custom_airport_pickup',
      4: 'custom_driver_note',
    };

    const parsed = parseGoogleSheetCsv(csvContent, customMappings, dynamicFields);
    expect(parsed.length).toBe(1);
    expect(parsed[0].guestName).toBe('Anand V');
    expect(parsed[0].customFields?.['custom_airport_pickup']).toBe(1500);
    expect(parsed[0].customFields?.['custom_driver_note']).toBe('Meet at Terminal 2 gate 4');
  });

  it('auto-calculates GST (18%) split and assigns Whole Villa unit when columns are missing', () => {
    const csvContent = `Date,Guest name,Total Amount\n5-Jun-2026,Anand V,11800`;
    const parsed = parseGoogleSheetCsv(csvContent);

    expect(parsed.length).toBe(1);
    expect(parsed[0].guestName).toBe('Anand V');
    expect(parsed[0].roomLabel).toBe('Whole Villa');
    expect(parsed[0].guestTotal).toBe(11800);
    expect(parsed[0].guestBase).toBe(10000);
    expect(parsed[0].guestTaxes).toBe(1800);
    expect(parsed[0].reconciliationNote).toContain('GST (18%) split');
    expect(parsed[0].reconciliationNote).toContain('Whole Villa');
  });

  it('parses sample Google Sheet CSV rows into structured import objects', () => {
    const csvContent = `Date,Guest name,Room,Site,Base fair,Number of days,Taxes / Percentage,Services charge / Percentage,Total Amount,Base fair,rate adjustment,Service fee / Percentage,Tax / Percentage,Additional Income,Total,Contact,Amount Credited,Credited Date,Note
2-Jun-2026,Midde Panduranga,405,Airbnb,2080.00,1,104,293.65,2477.65,2600,520,62.4,2.08,0,2015.52,8639523868,EVERLOFT - KGB,Credited 3th June,Credited 3th June
3-Jun-2026,Sachinkumaar,306,Airbnb,2080.00,1,104,293.65,2477.65,2600,520,62.4,2.08,0,2015.52,,EVERLOFT - KGB,Credited 6th June,Credited 6th June Kgb Combine 6k
4-Jun-2026,Muhammed Ashique A T,405,Airbnb,4974.36,2,208.8,589.56,4974.36,5220,1044,125.28,4.18,1500,5546.54,,EVERLOFT - KGB,Credited 6th June,4046.54 total`;

    const parsed = parseGoogleSheetCsv(csvContent);

    expect(parsed.length).toBe(3);

    // Row 1
    expect(parsed[0].guestName).toBe('Midde Panduranga');
    expect(parsed[0].roomLabel).toBe('405');
    expect(parsed[0].source).toBe('Airbnb');
    expect(parsed[0].checkInDate).toBe('2026-06-02');
    expect(parsed[0].checkOutDate).toBe('2026-06-03');
    expect(parsed[0].nights).toBe(1);
    expect(parsed[0].guestTotal).toBe(2477.65);
    expect(parsed[0].hostTotal).toBe(2015.52);
    expect(parsed[0].amountCreditedBank).toBe('EVERLOFT - KGB');
    expect(parsed[0].isValid).toBe(true);

    // Row 3
    expect(parsed[2].guestName).toBe('Muhammed Ashique A T');
    expect(parsed[2].nights).toBe(2);
    expect(parsed[2].hostAdditionalIncome).toBe(1500);
    expect(parsed[2].hostTotal).toBe(5546.54);
  });
});
