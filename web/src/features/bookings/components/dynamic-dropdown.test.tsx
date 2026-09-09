import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DynamicDropdown } from './dynamic-dropdown';

describe('DynamicDropdown Component', () => {
  it('renders default options in select element', () => {
    const { container } = render(
      <DynamicDropdown
        name="unit_label"
        label="Room / Unit Reference"
        defaultValue="405"
        defaultOptions={['405', '306', '406']}
      />
    );

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('405');

    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('405');
    expect(options).toContain('306');
    expect(options).toContain('406');
    expect(options).toContain('__ADD_NEW__');
  });

  it('allows adding a new custom option dynamically', () => {
    const { container } = render(
      <DynamicDropdown
        name="unit_label"
        label="Room / Unit Reference"
        defaultValue="405"
        defaultOptions={['405', '306']}
      />
    );

    const addButton = container.querySelector('button[title="Add new Room / Unit Reference"]') as HTMLButtonElement;
    fireEvent.click(addButton);

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: 'Penthouse 701' } });

    const submitAddButton = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(submitAddButton);

    const hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hiddenInput.value).toBe('Penthouse 701');
  });
});
