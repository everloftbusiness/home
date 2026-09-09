# Bookings & Settlements — first implementation

This module implements the first booking/finance slice of the existing Hospitality Asset Management Platform blueprint. It is not a completed accounting system.

## Entry points

- `/dashboard/bookings`: server-filtered, sorted, paginated register; selectable columns; draft/outstanding shortcuts; filtered CSV export (maximum 1,000 rows, larger exports explicitly rejected).
- `/dashboard/bookings/new`: select a property, find/reuse a guest or create one, enter the stay and independent guest/host financial lines.
- `/dashboard/bookings/[id]`: breakdowns, editable draft, finalize, stay status, receipts/refunds/deposits and payment reversals.
- Property details link to the same register with a property filter.

## Data and controls

Migration `20260906000002_booking_settlements.sql` creates `guest_profiles`, `bookings`, `booking_financial_lines`, `transactions`, `booking_payments` and the security-invoker `booking_register` view. Migration `20260906000003_booking_collection_mode.sql` adds explicit direct/platform collection responsibility. Both were applied to the linked Supabase project on September 6, 2026; the register contains no imported historical records.

Only `manage_booking_register` permits access. Initial grants are Super Admin and Finance Admin, with company-wide scope. Existing owner/investor `view_financials` grants do not expose this register. Future partner reporting needs purpose-built property/portfolio-scoped views; do not simply grant this permission to partners.

All writes use permission-checked atomic RPCs with restricted execute grants. Direct client table writes have no RLS policies. New table mutations feed the existing audit log. A draft edit checks the version last read to avoid overwriting another editor. Finalizing locks charges and stay particulars; stay status can still be updated. Payment reversal preserves the original entry and its reason. It corrects a record; it does not initiate a banking transaction.

Amounts use Postgres exact numeric arithmetic and currency precision checks. Supported initial currencies: INR, USD, EUR, GBP, AED (2 decimals), JPY (0), KWD (3). Each booking and its receipts use the same currency. Never combine currencies in a report without an explicit FX policy. UI totals use integer minor units. The supported per-line/receipt amount is capped at 999,999,999.

Guest lines and host lines are independent signed amounts. A deduction is negative. Platform labels are preserved. Tax treatment is entered from the actual statement; this module does not infer tax rates from the marketing checkout. Inclusive taxes must not be counted twice.

`guest_total` is the reported charge total, not proof that money was received. `guest_collection` records direct Everloft collection; `host_payout` records a platform/host settlement. Do not record the same OTA bank credit under both types. Refundable deposits are separately tracked. An expected payout is not recognized company revenue. For platform collection, payout difference is expected host payout minus net recorded host receipts. For direct collection, guest balance is guest charges minus direct receipts and platform payout difference is zero. Platform guest balance is unknown (null), never assumed paid. Bank reconciliation is not yet implemented.

Create/receipt request UUIDs protect retries from duplication. External reservation references are unique within property and channel when supplied. Guest matching is explicit and never silently merges people. Unit labels are references only: existing bedroom metadata is not assumed to be independently rentable inventory.

## Boundaries and next modules

The current UI does not import the PDF or write its historic guest records. It does not reserve calendar inventory or migrate SQLite checkout. No existing illustrative dashboards have been repointed to these figures.

Remaining: rentable-unit inventory and atomic availability constraints; calendar booking linkage; multi-booking settlement allocation; FX settlements; verified guest-paid-by-platform records; structured tax bases/rates/remitter metadata; document attachments; CSV import and reconciliation preview; persisted saved views and custom-field administration; finalized charge amendments; bank matching; agreements and owner/investor allocations; expenses; double-entry journal, period close and company financial statements.

The initial `transactions.related_entity_id` FK is deliberately constrained to bookings. When other payment domains ship, extend this through typed relationships and migrations rather than dropping integrity checks casually. Amounts remain on transactions, not duplicated in booking_payments.

## Validation

- `npm run test:booking-db`: executes the migration in isolated PGlite, checking actual PDF amounts, failed-write rollback, retries, finalized locks, deposits, reversals, denied access/direct writes, and audit triggers. The harness stubs the pre-existing auth/property foundation; it does not authenticate against or mutate the live project.
- `npx vitest run src/features/bookings`: exact decimal and schema checks, plus component checks.
- `npx tsc --noEmit` and targeted ESLint.

Apply this additive migration with the existing Supabase CLI workflow after validation. No financial data is seeded.

Live checks: Super Admin's permission and register query passed; register/new/export HTTP routes returned 200 through an authenticated local session. The final production build, TypeScript, targeted ESLint, eight feature tests and isolated database checks passed. No browser surface was connected, so visual browser verification remains outstanding.
