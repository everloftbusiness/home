'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  SlidersHorizontal,
  Download,
  FileSpreadsheet,
  Plus,
  Eye,
  X,
  ChevronRight,
  Sparkles,
  Building2,
  TrendingUp,
  Wallet,
  Banknote,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Receipt,
  ArrowUpDown,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CURRENCIES,
  STATUSES,
  SORT_FIELDS,
  type BookingRow,
  type PropertyOption,
  type RegisterFilters,
  type FinancialLine,
  type PaymentRow
} from '../types/booking.types';
import { money } from '../utils/money';
import { getBookingDetailsAction } from '../actions/booking.actions';
import { CsvImportModal } from './csv-import-modal';
import { GoogleSheetSyncModal } from './google-sheet-sync-modal';

type GroupType = 'stay' | 'guest' | 'host';

const columns: {
  key: typeof SORT_FIELDS[number];
  label: string;
  financial?: boolean;
  group: GroupType;
}[] = [
  // Stay Particulars
  { key: 'reservation_code', label: 'Booking', group: 'stay' },
  { key: 'guest_name', label: 'Guest', group: 'stay' },
  { key: 'property_name', label: 'Property', group: 'stay' },
  { key: 'unit_label', label: 'Unit', group: 'stay' },
  { key: 'check_in_date', label: 'Check-in', group: 'stay' },
  { key: 'check_out_date', label: 'Check-out', group: 'stay' },
  { key: 'nights', label: 'Nights', group: 'stay' },
  { key: 'source', label: 'Channel', group: 'stay' },
  { key: 'status', label: 'Stay status', group: 'stay' },
  { key: 'financial_status', label: 'Breakdown', group: 'stay' },

  // Guest Charges (Left Ledger)
  { key: 'guest_total', label: 'Guest charges', financial: true, group: 'guest' },
  { key: 'guest_received', label: 'Direct collections', financial: true, group: 'guest' },
  { key: 'guest_balance', label: 'Guest balance', financial: true, group: 'guest' },

  // Host Payout & Bank Settlement (Right Ledger)
  { key: 'host_total', label: 'Expected payout', financial: true, group: 'host' },
  { key: 'host_received', label: 'Payout received', financial: true, group: 'host' },
  { key: 'payout_balance', label: 'Payout difference', financial: true, group: 'host' },
  { key: 'collection_mode', label: 'Collection mode', group: 'host' },
  { key: 'deposit_held', label: 'Deposit held', financial: true, group: 'host' },

  // Optional Toggleable Columns
  { key: 'currency', label: 'Currency', group: 'stay' },
  { key: 'adults', label: 'Adults', group: 'stay' },
  { key: 'children', label: 'Children', group: 'stay' },
  { key: 'booking_date', label: 'Booking date', group: 'stay' },
  { key: 'external_booking_ref', label: 'Platform reference', group: 'stay' },
  { key: 'email', label: 'Email', group: 'stay' },
  { key: 'phone', label: 'Phone', group: 'stay' },
  { key: 'country', label: 'Country', group: 'stay' },
  { key: 'created_at', label: 'Created', group: 'stay' },
];

const defaults = [
  'reservation_code',
  'guest_name',
  'property_name',
  'unit_label',
  'check_in_date',
  'check_out_date',
  'source',
  'financial_status',
  'guest_total',
  'host_total',
  'host_received',
  'payout_balance',
  'guest_balance',
];

export function BookingRegister({
  rows,
  total,
  page,
  filters,
  properties,
}: {
  rows: BookingRow[];
  total: number;
  page: number;
  filters: RegisterFilters;
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const [visible, setVisible] = useState<string[]>(defaults);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Quick Row Preview Drawer State
  const [drawerRow, setDrawerRow] = useState<BookingRow | null>(null);
  const [drawerDetails, setDrawerDetails] = useState<{
    lines: FinancialLine[];
    payments: PaymentRow[];
  } | null>(null);
  const [isPendingDrawer, startTransitionDrawer] = useTransition();

  function openDrawer(row: BookingRow) {
    setDrawerRow(row);
    setDrawerDetails(null);
    startTransitionDrawer(async () => {
      try {
        const details = await getBookingDetailsAction(row.id);
        if (details) {
          setDrawerDetails({
            lines: details.lines.map((l) => ({ ...l, amount: String(l.amount) })),
            payments: details.payments,
          });
        }
      } catch (err) {
        console.error('Failed to fetch drawer booking details:', err);
      }
    });
  }

  function url(patch: Record<string, string>) {
    const params = new URLSearchParams();
    Object.entries({ ...filters, ...patch }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    return `/dashboard/bookings?${params}`;
  }

  function filter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(
      url({
        ...(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>),
        page: '1',
      })
    );
  }

  const control =
    'h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus:ring-1 focus:ring-ring';

  const shown = columns.filter((c) => visible.includes(c.key));

  // Compute Group Spans for Dual-Tier Header
  const stayCols = shown.filter((c) => c.group === 'stay');
  const guestCols = shown.filter((c) => c.group === 'guest');
  const hostCols = shown.filter((c) => c.group === 'host');

  // Compute Aggregate Totals for Summary Metrics
  const activeCurrency = filters.currency || rows[0]?.currency || 'INR';
  const totalGuestCharges = rows.reduce((sum, r) => sum + (r.guest_total || 0), 0);
  const totalExpectedHost = rows.reduce((sum, r) => sum + (r.host_total || 0), 0);
  const totalCreditedBank = rows.reduce(
    (sum, r) => sum + (r.host_received || 0) + (r.guest_received || 0),
    0
  );
  const totalOutstanding = rows.reduce(
    (sum, r) => sum + (r.payout_balance || 0) + (r.guest_balance || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sparkles className="h-3.5 w-3.5" /> Finance & OTA Ledger
            </span>
            <span className="text-xs text-muted-foreground">• Dual-Ledger Hospitality Accounting</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Bookings & Settlements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} booking{total === 1 ? '' : 's'} registered · Tracks guest tax/charges, expected payouts, and bank credits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GoogleSheetSyncModal properties={properties} />
          <CsvImportModal properties={properties} />
          <a
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/10 shadow-2xs"
            href={url({}).replace('/dashboard/bookings?', '/dashboard/bookings/export?')}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Export Excel (.xlsx)
          </a>
          <Button asChild variant="blue-accent" size="sm" className="shadow-xs">
            <Link href={`/dashboard/bookings/new${filters.property ? `?property=${filters.property}` : ''}`}>
              <Plus className="mr-1 h-4 w-4" /> Add booking
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Top Financial KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-blue-500/5 p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Guest Charges</span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {money(totalGuestCharges, activeCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Recorded guest charge total</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-purple-500/5 p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Expected Host Payout</span>
            <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {money(totalExpectedHost, activeCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Net OTA / platform payout</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-emerald-500/5 p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Bank Receipts Credited</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {money(totalCreditedBank, activeCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Total settled in bank accounts</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-amber-500/5 p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Balance</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
            {money(totalOutstanding, activeCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Pending payout & guest balance</p>
        </div>
      </div>

      {/* 3. Preset Filter Chips & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={!filters.financial && !filters.outstanding && !filters.q ? 'blue-accent' : 'outline'}
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => router.push('/dashboard/bookings')}
          >
            All Bookings
          </Button>
          <Button
            variant={filters.financial === 'draft' ? 'blue-accent' : 'outline'}
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => router.push(url({ financial: 'draft', outstanding: '', page: '1' }))}
          >
            <Clock className="mr-1 h-3 w-3" /> Drafts to Review
          </Button>
          <Button
            variant={filters.outstanding === 'yes' ? 'blue-accent' : 'outline'}
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => router.push(url({ financial: 'finalized', outstanding: 'yes', page: '1' }))}
          >
            <ShieldCheck className="mr-1 h-3 w-3" /> Outstanding Balances
          </Button>
          <Button
            variant={filters.q === 'DB' ? 'blue-accent' : 'outline'}
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => router.push(url({ q: 'DB', page: '1' }))}
          >
            Direct (DB)
          </Button>
          <Button
            variant={filters.q === 'Airbnb' ? 'blue-accent' : 'outline'}
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => router.push(url({ q: 'Airbnb', page: '1' }))}
          >
            Airbnb
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          >
            <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            {filterPanelOpen ? 'Hide Filters' : 'Filter & Search'}
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="h-8 rounded-lg text-xs"
            onClick={() => setColumnsOpen(!columnsOpen)}
          >
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> Columns
          </Button>
        </div>
      </div>

      {/* 4. Expandable Filter Form */}
      {filterPanelOpen && (
        <form
          onSubmit={filter}
          className="grid gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4"
          key={JSON.stringify(filters)}
        >
          <label className="grid gap-1 text-xs font-medium">
            Search
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={filters.q}
                placeholder="Guest, phone, code or channel"
                className="pl-8 text-xs"
              />
            </div>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Property
            <select className={control} name="property" defaultValue={filters.property ?? ''}>
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Stay status
            <select className={control} name="status" defaultValue={filters.status ?? ''}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Financial breakdown
            <select className={control} name="financial" defaultValue={filters.financial ?? ''}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="finalized">Finalized</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Check-in from
            <Input type="date" name="from" defaultValue={filters.from} className="text-xs" />
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Check-in through
            <Input type="date" name="to" defaultValue={filters.to} className="text-xs" />
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Currency
            <select className={control} name="currency" defaultValue={filters.currency ?? ''}>
              <option value="">All currencies</option>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button type="submit" variant="blue-accent" size="sm" className="w-full text-xs">
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => router.push('/dashboard/bookings')}
            >
              Reset
            </Button>
          </div>
        </form>
      )}

      {/* 5. Column Visibility Panel */}
      {columnsOpen && (
        <fieldset className="rounded-xl border border-border/60 bg-card p-4 shadow-xs space-y-3">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            Visible columns
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-blue-600 dark:text-blue-400">Stay Particulars</p>
              <div className="space-y-1.5">
                {columns
                  .filter((c) => c.group === 'stay')
                  .map((c) => (
                    <label className="flex items-center gap-2 text-xs text-foreground" key={c.key}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={visible.includes(c.key)}
                        onChange={(e) =>
                          setVisible((v) => (e.target.checked ? [...v, c.key] : v.filter((k) => k !== c.key)))
                        }
                      />
                      {c.label}
                    </label>
                  ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Guest Paid (Left Ledger)
              </p>
              <div className="space-y-1.5">
                {columns
                  .filter((c) => c.group === 'guest')
                  .map((c) => (
                    <label className="flex items-center gap-2 text-xs text-foreground" key={c.key}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={visible.includes(c.key)}
                        onChange={(e) =>
                          setVisible((v) => (e.target.checked ? [...v, c.key] : v.filter((k) => k !== c.key)))
                        }
                      />
                      {c.label}
                    </label>
                  ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Host Payout & Settlement (Right)
              </p>
              <div className="space-y-1.5">
                {columns
                  .filter((c) => c.group === 'host')
                  .map((c) => (
                    <label className="flex items-center gap-2 text-xs text-foreground" key={c.key}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        checked={visible.includes(c.key)}
                        onChange={(e) =>
                          setVisible((v) => (e.target.checked ? [...v, c.key] : v.filter((k) => k !== c.key)))
                        }
                      />
                      {c.label}
                    </label>
                  ))}
              </div>
            </div>
          </div>
        </fieldset>
      )}

      {/* 6. Dual-Tier Grouped Table View */}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-xs">
        <table className="w-full whitespace-nowrap text-left text-xs">
          {/* Top Tier Section Header Row */}
          <thead className="border-b bg-muted/70 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              {stayCols.length > 0 && (
                <th
                  colSpan={stayCols.length}
                  className="border-r px-4 py-2 text-blue-700 dark:text-blue-300 bg-blue-500/5 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-500" /> Stay & Guest Particulars
                  </div>
                </th>
              )}
              {guestCols.length > 0 && (
                <th
                  colSpan={guestCols.length}
                  className="border-r px-4 py-2 text-indigo-700 dark:text-indigo-300 bg-indigo-500/5 text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-indigo-500" /> Guest Paid (Left Ledger)
                  </div>
                </th>
              )}
              {hostCols.length > 0 && (
                <th
                  colSpan={hostCols.length}
                  className="px-4 py-2 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-500" /> Host Payout & Bank Settlement
                  </div>
                </th>
              )}
            </tr>

            {/* Individual Sub-Column Headers */}
            <tr className="border-t bg-muted/40 text-foreground font-medium">
              {shown.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 ${c.financial ? 'text-right font-semibold' : 'text-left'}`}
                  aria-sort={
                    filters.sort === c.key
                      ? filters.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <Link
                    className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
                    href={url({
                      sort: c.key,
                      direction: filters.sort === c.key && filters.direction === 'asc' ? 'desc' : 'asc',
                      page: '1',
                    })}
                  >
                    {c.label}
                    {filters.sort === c.key ? (
                      filters.direction === 'asc' ? (
                        ' ↑'
                      ) : (
                        ' ↓'
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.id} className="group hover:bg-muted/40 transition-colors">
                {shown.map((c) => {
                  // Custom Cell Rendering
                  if (c.key === 'reservation_code') {
                    return (
                      <td className="px-4 py-3 font-mono font-semibold text-blue-600 dark:text-blue-400" key={c.key}>
                        <div className="flex items-center gap-1.5">
                          <button
                            title="Quick preview drawer"
                            onClick={() => openDrawer(r)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <Link className="hover:underline" href={`/dashboard/bookings/${r.id}`}>
                            {r.reservation_code}
                          </Link>
                        </div>
                      </td>
                    );
                  }

                  if (c.key === 'guest_name') {
                    return (
                      <td className="px-4 py-3 font-medium text-foreground" key={c.key}>
                        <Link className="hover:text-blue-600 hover:underline" href={`/dashboard/bookings/${r.id}`}>
                          {r.guest_name}
                        </Link>
                      </td>
                    );
                  }

                  if (c.key === 'unit_label') {
                    return (
                      <td className="px-4 py-3" key={c.key}>
                        {r.unit_label ? (
                          <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            Room {r.unit_label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  }

                  if (c.key === 'source') {
                    const src = (r.source || '').toLowerCase();
                    const isAirbnb = src.includes('airbnb');
                    const isDirect = src.includes('db') || src.includes('direct');
                    const isBookingCom = src.includes('booking');

                    return (
                      <td className="px-4 py-3" key={c.key}>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                            isAirbnb
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                              : isDirect
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : isBookingCom
                              ? 'bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {r.source}
                        </span>
                      </td>
                    );
                  }

                  if (c.key === 'financial_status') {
                    const isDraft = r.financial_status === 'draft';
                    return (
                      <td className="px-4 py-3" key={c.key}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                            isDraft
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {isDraft ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {r.financial_status}
                        </span>
                      </td>
                    );
                  }

                  if (c.key === 'status') {
                    return (
                      <td className="px-4 py-3 capitalize text-muted-foreground" key={c.key}>
                        {r.status.replaceAll('_', ' ')}
                      </td>
                    );
                  }

                  if (c.key === 'collection_mode') {
                    return (
                      <td className="px-4 py-3" key={c.key}>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                            r.collection_mode === 'direct'
                              ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'
                              : 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20'
                          }`}
                        >
                          {r.collection_mode === 'direct' ? 'Direct Collection' : 'Platform Collection'}
                        </span>
                      </td>
                    );
                  }

                  if (c.financial) {
                    const val = r[c.key as keyof BookingRow];
                    const numVal = val === null ? null : Number(val);
                    const isBalanceCol = c.key === 'payout_balance' || c.key === 'guest_balance';
                    const hasBalance = numVal !== null && numVal > 0;

                    return (
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-mono ${
                          isBalanceCol && hasBalance
                            ? 'font-semibold text-amber-600 dark:text-amber-400'
                            : 'text-foreground'
                        }`}
                        key={c.key}
                      >
                        {numVal === null ? '—' : money(numVal, r.currency)}
                      </td>
                    );
                  }

                  return (
                    <td className="px-4 py-3 text-muted-foreground" key={c.key}>
                      {String(r[c.key as keyof BookingRow] ?? '—').replaceAll('_', ' ')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <div className="p-12 text-center">
            <h2 className="font-medium text-foreground">No bookings match this view</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Adjust filters or add a new booking to populate your register.
            </p>
          </div>
        )}
      </div>

      {/* 7. Pagination Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / 25))} ({total} total rows)
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="underline hover:text-foreground" href={url({ page: String(page - 1) })}>
              Previous
            </Link>
          )}
          {page * 25 < total && (
            <Link className="underline hover:text-foreground" href={url({ page: String(page + 1) })}>
              Next
            </Link>
          )}
        </div>
      </div>

      {/* 8. Row Quick Preview Slide-Over Drawer */}
      {drawerRow && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-lg bg-card border-l border-border/80 shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {drawerRow.reservation_code}
                </span>
                <h2 className="mt-1 text-xl font-bold text-foreground">{drawerRow.guest_name}</h2>
                <p className="text-xs text-muted-foreground">
                  {drawerRow.property_name} {drawerRow.unit_label ? `· Room ${drawerRow.unit_label}` : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setDrawerRow(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Stay Specs */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Stay Dates:</span>
                <p className="font-medium text-foreground">
                  {drawerRow.check_in_date} → {drawerRow.check_out_date} ({drawerRow.nights} nights)
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Channel / Ref:</span>
                <p className="font-medium text-foreground">
                  {drawerRow.source} {drawerRow.external_booking_ref ? `(${drawerRow.external_booking_ref})` : ''}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Financial Status:</span>
                <p className="font-medium capitalize text-foreground">{drawerRow.financial_status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Collection Mode:</span>
                <p className="font-medium capitalize text-foreground">{drawerRow.collection_mode}</p>
              </div>
            </div>

            {/* Financial Breakdown Preview */}
            {isPendingDrawer ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading itemized lines...</div>
            ) : drawerDetails ? (
              <div className="space-y-5">
                {/* Guest Charges Breakdown */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Guest Charges Breakdown
                    </h3>
                    <span className="font-mono font-bold text-sm">
                      {money(drawerRow.guest_total, drawerRow.currency)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {drawerDetails.lines
                      .filter((l) => l.side === 'guest')
                      .map((l, idx) => (
                        <div className="flex justify-between text-muted-foreground" key={idx}>
                          <span>
                            {l.label} <span className="text-[10px] opacity-70">({l.category})</span>
                          </span>
                          <span className="font-mono text-foreground">
                            {money(Number(l.amount), drawerRow.currency)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Host Payout Breakdown */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Host Payout Breakdown
                    </h3>
                    <span className="font-mono font-bold text-sm">
                      {money(drawerRow.host_total, drawerRow.currency)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {drawerDetails.lines
                      .filter((l) => l.side === 'host')
                      .map((l, idx) => (
                        <div className="flex justify-between text-muted-foreground" key={idx}>
                          <span>
                            {l.label} <span className="text-[10px] opacity-70">({l.category})</span>
                          </span>
                          <span className="font-mono text-foreground">
                            {money(Number(l.amount), drawerRow.currency)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bank Payments & Settlements Log */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Bank Credit & Receipts Log
                  </h3>
                  {drawerDetails.payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No bank payments recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {drawerDetails.payments.map((p) => (
                        <div
                          key={p.id}
                          className="rounded border bg-muted/30 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex justify-between font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {p.account_label || 'Bank Account'} ({p.payment_method})
                            </span>
                            <span className="font-mono font-bold">{money(p.amount, p.currency)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Settled: {p.settled_at?.slice(0, 10) || '—'}</span>
                            <span>Ref: {p.gateway_reference || '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Footer Action */}
            <div className="border-t pt-4 flex gap-3">
              <Button asChild variant="blue-accent" size="sm" className="w-full text-xs">
                <Link href={`/dashboard/bookings/${drawerRow.id}`}>
                  Open Full Record & Edit <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
