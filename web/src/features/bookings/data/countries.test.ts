import { describe, it, expect } from 'vitest';
import { WORLD_COUNTRIES, findCountry } from './countries';

describe('countries data and lookup', () => {
  it('should contain full world countries list with name, code, and dialCode', () => {
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(100);
    const india = WORLD_COUNTRIES.find((c) => c.code === 'IN');
    expect(india).toBeDefined();
    expect(india?.name).toBe('India');
    expect(india?.dialCode).toBe('+91');

    const uae = WORLD_COUNTRIES.find((c) => c.code === 'AE');
    expect(uae).toBeDefined();
    expect(uae?.name).toBe('United Arab Emirates');
    expect(uae?.dialCode).toBe('+971');
  });

  it('should find country by dialCode with plus sign (+971)', () => {
    const res = findCountry('+971');
    expect(res?.name).toBe('United Arab Emirates');
  });

  it('should find country by dialCode digits (971)', () => {
    const res = findCountry('971');
    expect(res?.name).toBe('United Arab Emirates');
  });

  it('should find country by ISO code (IN, AE, US, GB)', () => {
    expect(findCountry('IN')?.name).toBe('India');
    expect(findCountry('AE')?.name).toBe('United Arab Emirates');
    expect(findCountry('US')?.name).toBe('United States');
    expect(findCountry('GB')?.name).toBe('United Kingdom');
  });

  it('should find country from full phone numbers with country code prefix', () => {
    expect(findCountry('+971 50 123 4567')?.name).toBe('United Arab Emirates');
    expect(findCountry('+44 7911 123456')?.name).toBe('United Kingdom');
    expect(findCountry('+91 9876543210')?.name).toBe('India');
    expect(findCountry('+1 2125550199')?.name).toBe('United States');
    expect(findCountry('+966 501234567')?.name).toBe('Saudi Arabia');
  });
});
