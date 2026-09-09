'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Search,
  Building2,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  Receipt,
  Banknote,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  Globe,
  Phone
} from 'lucide-react';
import { saveBookingAction, searchGuestsAction } from '../actions/booking.actions';
import { bookingSchema } from '../schemas/booking.schema';
import {
  CATEGORIES,
  CURRENCIES,
  STATUSES,
  type FinancialLine,
  type PropertyOption,
  type BookingRow,
  type GuestOption,
} from '../types/booking.types';
import { sumAmounts, money } from '../utils/money';
import { DynamicDropdown } from './dynamic-dropdown';

import { WORLD_COUNTRIES, findCountry } from '../data/countries';
import { isSingleUnitProperty } from '../utils/csv-parser';

const control =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus:ring-1 focus:ring-ring';

export { WORLD_COUNTRIES };

export function BookingForm({
  properties,
  propertyId,
  booking,
  initialLines,
}: {
  properties: PropertyOption[];
  propertyId?: string;
  booking?: BookingRow;
  initialLines?: FinancialLine[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [currency, setCurrency] = useState(booking?.currency ?? 'INR');

  // Dates state for dynamic night count calculation
  const today = new Date().toLocaleDateString('en-CA');
  const [checkIn, setCheckIn] = useState(booking?.check_in_date ?? '');
  const [checkOut, setCheckOut] = useState(booking?.check_out_date ?? '');
  const [nightsCount, setNightsCount] = useState(booking?.nights ?? 0);

  // Property & Unit State
  const initialPropId = booking?.property_id ?? propertyId ?? (properties[0]?.id || '');
  const initialProp = properties.find((p) => p.id === initialPropId);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropId);
  const [isPoolVilla, setIsPoolVilla] = useState<boolean>(
    initialProp ? initialProp.property_type === 'single_unit' || isSingleUnitProperty(initialProp.name) : false
  );
  const [unitLabel, setUnitLabel] = useState<string>(
    booking?.unit_label ?? (isPoolVilla ? 'Whole Villa' : '405')
  );

  useEffect(() => {
    if (checkIn && checkOut) {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setNightsCount(diffDays > 0 ? diffDays : 0);
    }
  }, [checkIn, checkOut]);

  // Guest State - Controlled Form Fields
  const [guestId, setGuestId] = useState<string>(booking?.primary_guest_id ?? '');
  const [guestName, setGuestName] = useState<string>(booking?.guest_name ?? '');
  const [guestEmail, setGuestEmail] = useState<string>(booking?.email ?? '');
  const [guestPhone, setGuestPhone] = useState<string>(booking?.phone ?? '+91 ');
  const [guestCountry, setGuestCountry] = useState<string>(booking?.country ?? 'India');

  // Search Guest State
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [guestQuery, setGuestQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [matchedBadge, setMatchedBadge] = useState<string | null>(null);

  // Direction A: Country Changes -> Auto-fill / update Phone Country Code
  function handleCountryChange(newCountryInput: string) {
    setGuestCountry(newCountryInput);
    const matched = findCountry(newCountryInput);

    if (matched) {
      // If user typed dialCode or country code, normalize country name
      if (
        newCountryInput.trim().startsWith('+') ||
        newCountryInput.trim().toUpperCase() === matched.code ||
        newCountryInput.trim() === matched.dialCode.replace('+', '')
      ) {
        setGuestCountry(matched.name);
      }
      // Preserve subscriber number if phone already contains extra digits
      const subNumber = guestPhone.replace(/^\+\d{1,4}\s*/, '');
      setGuestPhone(`${matched.dialCode} ${subNumber}`.trim() + ' ');
    }
  }

  // Direction B: Phone / Country Code Entry -> Auto-detect & fill Country
  function handlePhoneChange(newPhoneInput: string) {
    setGuestPhone(newPhoneInput);
    const matched = findCountry(newPhoneInput);

    if (matched && guestCountry.toLowerCase().trim() !== matched.name.toLowerCase()) {
      setGuestCountry(matched.name);
    }
  }

  // Populate form fields directly when an existing guest is selected from search results
  function handleSelectGuest(g: GuestOption) {
    setGuestId(g.id);
    setGuestName(g.full_name);
    if (g.email) setGuestEmail(g.email);
    if (g.phone) {
      handlePhoneChange(g.phone);
    }
    setGuests([]);
    setMatchedBadge(`Filled from profile: ${g.full_name}`);
    toast.success(`Fields populated from profile: ${g.full_name}`);
  }

  // Financial Breakdown Lines
  const [lines, setLines] = useState<FinancialLine[]>(
    initialLines ?? [
      { side: 'guest', category: 'accommodation', label: 'Base Accommodation Charge', amount: '0' },
      { side: 'guest', category: 'tax', label: 'Taxes & GST (18%)', amount: '0' },
      { side: 'guest', category: 'guest_service_fee', label: 'Guest Service Charge', amount: '0' },
      { side: 'host', category: 'accommodation', label: 'Host Base Payout', amount: '0' },
      { side: 'host', category: 'rate_adjustment', label: 'Rate Adjustment', amount: '0' },
      { side: 'host', category: 'host_service_fee', label: 'Channel Service Fee', amount: '0' },
      { side: 'host', category: 'withholding', label: 'Host Tax / Withholding', amount: '0' },
    ]
  );

  function updateLine(index: number, patch: Partial<FinancialLine>) {
    setLines((old) => old.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine(side: 'guest' | 'host', category: string = 'other', defaultLabel: string = '') {
    setLines((old) => [...old, { side, category, label: defaultLabel, amount: '0' }]);
  }

  function removeLine(index: number) {
    setLines((old) => old.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const input = bookingSchema.parse({
        ...fields,
        id: booking?.id,
        updated_at: booking?.updated_at,
        request_id: requestId,
        guest_id: guestId,
        guest_name: guestName || fields.guest_name,
        email: guestEmail || fields.email || '',
        phone: guestPhone || fields.phone || '',
        country: guestCountry || fields.country || '',
        currency,
        lines,
      });

      const id = await saveBookingAction(input);
      toast.success('Booking draft saved successfully');
      router.push(`/dashboard/bookings/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save booking.');
    } finally {
      setBusy(false);
    }
  }

  async function findGuests() {
    setSearching(true);
    setError('');
    try {
      const rows = await searchGuestsAction(guestQuery);
      setGuests(rows);
      if (!rows.length) toast.info('No matching guests found. Fill in guest details below.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* 1. Guest Information Card */}
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Guest Information</h2>
              <p className="text-xs text-muted-foreground">Search existing guests or edit guest profile fields directly.</p>
            </div>
          </div>
          {matchedBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" /> {matchedBadge}
            </span>
          )}
        </div>

        {/* Find Guest Search Bar */}
        {!booking && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  aria-label="Find an existing guest"
                  placeholder="Search existing guest by name, phone or email..."
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-medium"
                disabled={searching || guestQuery.trim().length < 2}
                onClick={findGuests}
              >
                {searching ? 'Searching…' : 'Find Guest'}
              </Button>
            </div>

            {/* Search Results Dropdown List */}
            {guests.length > 0 && (
              <div className="grid gap-1.5 rounded-xl border bg-card p-3 shadow-md animate-in fade-in">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Click a guest to auto-fill form fields:
                </p>
                {guests.map((g) => (
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 text-left text-xs hover:bg-blue-500/10 hover:border-blue-500/40 transition-colors"
                    key={g.id}
                    onClick={() => handleSelectGuest(g)}
                  >
                    <div>
                      <span className="font-semibold text-foreground">{g.full_name}</span>
                      <span className="ml-2 text-muted-foreground">({g.email || g.phone || 'No contact'})</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Fill Fields →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fully Editable Guest Fields (Auto-synced & 2-Way Bound) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Full name *
            <Input
              name="guest_name"
              type="text"
              required
              placeholder="e.g. Midde Panduranga"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="text-xs"
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Email address
            <Input
              name="email"
              type="email"
              placeholder="guest@example.com"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="text-xs"
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Country *
            <select
              name="country"
              className={control}
              required
              value={guestCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              <option value="">Select Country...</option>
              {WORLD_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name} ({c.dialCode})
                </option>
              ))}
              {guestCountry &&
                !WORLD_COUNTRIES.some((c) => c.name.toLowerCase() === guestCountry.toLowerCase()) && (
                  <option value={guestCountry}>{guestCountry}</option>
                )}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Phone (with country code)
            <Input
              name="phone"
              type="tel"
              placeholder="e.g. +91 9876543210"
              value={guestPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="text-xs font-mono"
            />
          </label>
        </div>
      </section>

      {/* 2. Stay & Inventory Particulars Card */}
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Stay & Inventory Particulars</h2>
              <p className="text-xs text-muted-foreground">Property, room reference, stay dates, and channel particulars.</p>
            </div>
          </div>
          {nightsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
              <Calendar className="h-3.5 w-3.5" /> {nightsCount} Night{nightsCount === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-foreground">
            Target Property *
            <select
              name="property_id"
              className={control}
              value={selectedPropertyId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedPropertyId(newId);
                const prop = properties.find((p) => p.id === newId);
                const isVilla = prop ? prop.property_type === 'single_unit' || isSingleUnitProperty(prop.name) : false;
                setIsPoolVilla(isVilla);
                setUnitLabel(isVilla ? 'Whole Villa' : '405');
              }}
              required
            >
              <option value="">Select Property</option>
              {properties.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name} {p.property_type === 'single_unit' || isSingleUnitProperty(p.name) ? '(Pool Villa)' : ''}
                </option>
              ))}
            </select>
          </label>

          <DynamicDropdown
            key={`${selectedPropertyId}-${isPoolVilla}`}
            name="unit_label"
            label={isPoolVilla ? 'Property Inventory (Independent Villa)' : 'Room / Unit Reference'}
            defaultValue={unitLabel}
            defaultOptions={isPoolVilla ? ['Whole Villa', 'Main Villa', 'Pool Villa'] : ['405', '306', '406', '403', '501', '502']}
            placeholder={isPoolVilla ? 'Whole Villa' : 'Select or add room...'}
            storageKey={isPoolVilla ? 'villa_units' : 'unit_labels'}
          />

          <DynamicDropdown
            name="source"
            label="Channel Source *"
            defaultValue={booking?.source ?? 'Airbnb'}
            defaultOptions={['Airbnb', 'DB', 'Booking.com', 'Agoda', 'MakeMyTrip', 'Goibibo', 'VRBO']}
            placeholder="Select channel..."
            storageKey="channel_sources"
            required
          />

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Channel Reference / Ref ID
            <Input
              name="external_booking_ref"
              type="text"
              defaultValue={booking?.external_booking_ref ?? ''}
              placeholder="e.g. HM12345678"
              className="text-xs"
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Booking Date *
            <Input
              name="booking_date"
              type="date"
              defaultValue={booking?.booking_date ?? today}
              required
              className="text-xs"
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Stay Status
            <select className={control} name="status" defaultValue={booking?.status ?? 'confirmed'}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Check-in Date *
            <Input
              type="date"
              name="check_in_date"
              defaultValue={booking?.check_in_date ?? ''}
              required
              className="text-xs"
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Check-out Date *
            <Input
              type="date"
              name="check_out_date"
              defaultValue={booking?.check_out_date ?? ''}
              required
              className="text-xs"
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Adults *
              <Input
                name="adults"
                type="number"
                defaultValue={booking?.adults ?? 1}
                required
                className="text-xs"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-foreground">
              Children *
              <Input
                name="children"
                type="number"
                defaultValue={booking?.children ?? 0}
                required
                className="text-xs"
              />
            </label>
          </div>

          <label className="grid gap-1 text-xs font-medium text-foreground">
            Currency
            <select
              className={control}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium text-foreground sm:col-span-2">
            Collection Responsibility
            <select
              className={control}
              name="collection_mode"
              defaultValue={booking?.collection_mode ?? 'platform'}
            >
              <option value="platform">Platform Collects (OTA receives guest payment & remits payout)</option>
              <option value="direct">Everloft Collects Direct (Guest pays directly to Everloft bank)</option>
            </select>
          </label>
        </div>
      </section>

      {/* 3. Dual-Ledger Financial Breakdown Cards (Guest Charges vs Host Payout) */}
      <div className="grid gap-6 xl:grid-cols-2">
        {(['guest', 'host'] as const).map((side) => {
          let calculatedTotal = '0.00';
          try {
            calculatedTotal = money(
              sumAmounts(
                lines.filter((l) => l.side === side).map((l) => l.amount),
                currency
              ),
              currency
            );
          } catch {}

          const isGuest = side === 'guest';

          return (
            <section
              key={side}
              className={`rounded-xl border bg-card p-5 shadow-xs space-y-4 ${
                isGuest ? 'border-indigo-500/30' : 'border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`rounded-lg p-2 ${
                      isGuest
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isGuest ? <Receipt className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {isGuest ? 'Guest Charges Breakdown' : 'Expected Host Payout Breakdown'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {isGuest ? 'What the guest actually pays' : 'Net payout expected by Everloft'}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-muted-foreground uppercase block">Total</span>
                  <strong className="text-base font-bold text-foreground tabular-nums">
                    {calculatedTotal}
                  </strong>
                </div>
              </div>

              {/* Line Items Container */}
              <div className="space-y-2.5">
                {lines.map((line, index) =>
                  line.side !== side ? null : (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_120px_auto] gap-2 rounded-lg border bg-muted/20 p-2.5 text-xs items-center"
                    >
                      <div className="space-y-1">
                        <select
                          aria-label={`${side} line ${index + 1} category`}
                          className={control}
                          value={line.category}
                          onChange={(e) => updateLine(index, { category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => (
                            <option value={c} key={c}>
                              {c.replaceAll('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <Input
                          aria-label={`${side} line ${index + 1} label`}
                          placeholder="Statement line label"
                          value={line.label}
                          onChange={(e) => updateLine(index, { label: e.target.value })}
                          required
                          className="text-xs"
                        />
                      </div>

                      <div className="relative">
                        <Input
                          aria-label={`${side} line ${index + 1} amount`}
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) => updateLine(index, { amount: e.target.value })}
                          required
                          className="text-xs font-mono font-semibold text-right"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600 rounded-lg"
                        aria-label={`Remove ${line.label}`}
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                )}
              </div>

              {/* Add Line Action */}
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="w-full h-8 text-xs font-medium"
                onClick={() => addLine(side, 'other', isGuest ? 'Additional Guest Charge' : 'Adjustment Line')}
              >
                <Plus className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Add {isGuest ? 'Charge' : 'Payout Line'}
              </Button>
            </section>
          );
        })}
      </div>

      {/* 4. Internal Notes */}
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
        <label className="text-xs font-semibold text-foreground block">
          Internal Accounting & Stay Notes
        </label>
        <textarea
          className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-xs focus:ring-1 focus:ring-ring"
          name="notes"
          placeholder="Enter payment reference notes, guest special requests, or bank settlement notes..."
          defaultValue={booking?.notes ?? ''}
          maxLength={5000}
        />
      </section>

      {/* Error Notice */}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* 5. Sticky Action Footer */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 shadow-xs">
        <Button type="submit" variant="blue-accent" disabled={busy} className="font-semibold text-xs px-6">
          {busy ? (
            'Saving Booking Draft...'
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Save Booking Draft
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Provisional totals. You can review and finalize breakdown after saving.
        </p>
      </div>
    </form>
  );
}
