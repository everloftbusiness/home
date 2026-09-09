import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingForm } from './booking-form';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock Server Actions
vi.mock('../actions/booking.actions', () => ({
  saveBookingAction: vi.fn(),
  searchGuestsAction: vi.fn(),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('BookingForm Country & Phone Auto-sync', () => {
  const dummyProperties = [
    { id: 'prop-1', name: 'Everloft Apartments', slug: 'everloft-apartments', property_type: 'multi_unit' as const },
    { id: 'prop-2', name: 'Villa Zephyr (Pool Villa)', slug: 'villa-zephyr', property_type: 'single_unit' as const },
  ];

  it('renders Country * and Phone fields with initial defaults', () => {
    const { container } = render(<BookingForm properties={dummyProperties} />);

    const countrySelect = container.querySelector('select[name="country"]') as HTMLSelectElement;
    const phoneInput = container.querySelector('input[name="phone"]') as HTMLInputElement;

    expect(countrySelect).toBeDefined();
    expect(phoneInput).toBeDefined();
    expect(countrySelect.value).toBe('India');
    expect(phoneInput.value).toBe('+91 ');
  });

  it('auto-fills country name when a calling code (+971) is typed into Phone field', () => {
    const { container } = render(<BookingForm properties={dummyProperties} />);

    const countrySelect = container.querySelector('select[name="country"]') as HTMLSelectElement;
    const phoneInput = container.querySelector('input[name="phone"]') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: '+971 501234567' } });

    expect(countrySelect.value).toBe('United Arab Emirates');
    expect(phoneInput.value).toBe('+971 501234567');
  });

  it('auto-fills calling code (+44) into Phone field when United Kingdom is selected in Country field', () => {
    const { container } = render(<BookingForm properties={dummyProperties} />);

    const countrySelect = container.querySelector('select[name="country"]') as HTMLSelectElement;
    const phoneInput = container.querySelector('input[name="phone"]') as HTMLInputElement;

    fireEvent.change(countrySelect, { target: { value: 'United Kingdom' } });

    expect(countrySelect.value).toBe('United Kingdom');
    expect(phoneInput.value).toContain('+44');
  });

  it('auto-fills dial code (+966) into Phone field when Saudi Arabia is selected in Country select dropdown', () => {
    const { container } = render(<BookingForm properties={dummyProperties} />);

    const countrySelect = container.querySelector('select[name="country"]') as HTMLSelectElement;
    const phoneInput = container.querySelector('input[name="phone"]') as HTMLInputElement;

    fireEvent.change(countrySelect, { target: { value: 'Saudi Arabia' } });

    expect(countrySelect.value).toBe('Saudi Arabia');
    expect(phoneInput.value).toContain('+966');
  });

  it('automatically sets unit_label to Whole Villa when a Pool Villa property is selected', () => {
    const { container } = render(<BookingForm properties={dummyProperties} />);

    const propertySelect = container.querySelector('select[name="property_id"]') as HTMLSelectElement;
    fireEvent.change(propertySelect, { target: { value: 'prop-2' } });

    const hiddenUnitInput = container.querySelector('input[name="unit_label"]') as HTMLInputElement;
    expect(hiddenUnitInput.value).toBe('Whole Villa');
  });
});
