'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Check, ChevronDown, X } from 'lucide-react';

export function DynamicDropdown({
  name,
  label,
  defaultValue = '',
  defaultOptions = [],
  placeholder = 'Select option...',
  storageKey,
  required = false,
}: {
  name: string;
  label?: string;
  defaultValue?: string;
  defaultOptions: string[];
  placeholder?: string;
  storageKey?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState<string[]>(defaultOptions);
  const [selected, setSelected] = useState<string>(defaultValue || defaultOptions[0] || '');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');

  // Load custom options from localStorage if storageKey provided
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`everloft_dropdown_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved) as string[];
          const merged = Array.from(new Set([...defaultOptions, ...parsed]));
          setOptions(merged);
        }
      } catch (err) {
        console.error('Failed to load dynamic dropdown options:', err);
      }
    }
  }, [storageKey, defaultOptions]);

  // Sync value if defaultValue changes externally
  useEffect(() => {
    if (defaultValue) {
      setSelected(defaultValue);
      if (!options.includes(defaultValue)) {
        setOptions((prev) => Array.from(new Set([...prev, defaultValue])));
      }
    }
  }, [defaultValue]);

  function saveOptionsToStorage(updatedOptions: string[]) {
    if (storageKey && typeof window !== 'undefined') {
      try {
        // Save only options that are not in defaultOptions
        const customOnly = updatedOptions.filter((o) => !defaultOptions.includes(o));
        localStorage.setItem(`everloft_dropdown_${storageKey}`, JSON.stringify(customOnly));
      } catch (err) {
        console.error('Failed to save dynamic dropdown options:', err);
      }
    }
  }

  function handleAddNew() {
    const val = newOptionValue.trim();
    if (!val) return;

    if (!options.includes(val)) {
      const updated = [...options, val];
      setOptions(updated);
      saveOptionsToStorage(updated);
    }
    setSelected(val);
    setNewOptionValue('');
    setIsAddingNew(false);
  }

  function handleRemoveOption(optToRemove: string) {
    const updated = options.filter((o) => o !== optToRemove);
    setOptions(updated);
    saveOptionsToStorage(updated);
    if (selected === optToRemove) {
      setSelected(updated[0] || '');
    }
  }

  return (
    <div className="grid gap-1 text-xs font-medium text-foreground">
      {label && <label className="block">{label}</label>}

      {/* Hidden Form Input for standard form submit */}
      <input type="hidden" name={name} value={selected} required={required} />

      {isAddingNew ? (
        <div className="flex items-center gap-1.5 animate-in fade-in">
          <Input
            type="text"
            placeholder={`Type new ${label || 'option'}...`}
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            className="h-9 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddNew();
              } else if (e.key === 'Escape') {
                setIsAddingNew(false);
              }
            }}
          />
          <Button
            type="button"
            variant="blue-accent"
            size="xs"
            className="h-9 px-3"
            onClick={handleAddNew}
          >
            <Check className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setIsAddingNew(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus:ring-1 focus:ring-ring cursor-pointer"
            value={selected}
            onChange={(e) => {
              if (e.target.value === '__ADD_NEW__') {
                setIsAddingNew(true);
              } else {
                setSelected(e.target.value);
              }
            }}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="__ADD_NEW__" className="font-semibold text-blue-600">
              + Add New Custom Option...
            </option>
          </select>

          {/* Quick Add Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-blue-600"
            title={`Add new ${label || 'option'}`}
            onClick={() => setIsAddingNew(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          {/* Remove custom option button if selected is custom */}
          {!defaultOptions.includes(selected) && selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-rose-600"
              title={`Remove '${selected}' option`}
              onClick={() => handleRemoveOption(selected)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
