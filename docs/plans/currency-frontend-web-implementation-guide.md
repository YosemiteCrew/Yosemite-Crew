# Frontend Web Currency Modernization Guide

## Objective

Remove hardcoded currency behavior from the PMS web application and replace it with a single production-grade currency presentation system for `EUR`, `USD`, and `GBP`.

This document is only for `apps/frontend`.

The backend and Stripe implementation details live in:

- `docs/plans/currency-backend-stripe-implementation-guide.md`

The mobile implementation details live in:

- `docs/plans/currency-mobile-implementation-guide.md`

## Scope

This guide covers:

- currency display and formatting on the web app
- pricing page presentment behavior
- currency-aware form labels and UI copy
- module-by-module frontend migration
- frontend tests and rollout checks

This guide does not cover:

- Stripe product/price configuration
- backend persistence and API contracts
- mobile Redux/storage changes

## Supported Currencies

Phase 1 supported currencies:

- `EUR`
- `USD`
- `GBP`

Audience mapping for presentment:

- UK audience => `GBP`
- US audience => `USD`
- EU/default audience => `EUR`

## Frontend Principles

### 1. The frontend is not the source of truth for transactional currency

For invoices, inventory, appointment finance, services, expenses, and payments:

- use the currency returned by the backend record whenever available
- never convert transactional values client-side
- never infer a new charge currency in the browser

### 2. Formatting must be centralized

Do not keep:

- component-local `Intl.NumberFormat`
- manual string building like `$ ${value}`
- hardcoded `USD`/`EUR` labels for value rendering

Replace them with one shared frontend currency utility layer.

### 3. Presentment currency and transaction currency are different

- presentment currency is for pricing page and optional display contexts
- transaction currency is the actual stored or charged currency
- presentment logic must never silently rewrite invoice or payment values

## Current Frontend Problems Found

### Fragmented formatters

- `apps/frontend/src/app/lib/money.ts` hardcodes `en-US` and rounds aggressively
- companion history has its own formatter
- lab tests have another formatter
- inventory cards/tables format prices manually

### Hardcoded symbols and codes

Examples already identified:

- `apps/frontend/src/app/ui/tables/InventoryTable.tsx`
- `apps/frontend/src/app/ui/cards/InventoryCard/index.tsx`
- `apps/frontend/src/app/features/inventory/pages/Inventory/utils.ts`
- `apps/frontend/src/app/hooks/useBilling.ts`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/data.ts`
- `apps/frontend/src/app/ui/widgets/Upgrade/index.tsx`

### Wrong currency resolution pattern

Several screens currently use org currency fallback for values that should use the record currency.

This is risky in:

- finance module
- appointment finance summary/details
- invoice card/table
- dashboard revenue widgets
- companion history

## Target Frontend Architecture

## Currency UI Layer

Create or adopt one frontend currency module responsible for:

- normalizing supported currency codes
- formatting numbers for `EUR/USD/GBP`
- formatting with locale
- formatting with a safe fallback if locale/currency input is bad
- resolving the correct display currency from available context

Recommended responsibilities:

- `formatCurrencyAmount(amount, currency, options)`
- `formatCurrencyCode(amount, currency)`
- `getCurrencySymbol(currency)`
- `isSupportedCurrency(currency)`
- `resolveDisplayCurrency({ recordCurrency, orgCurrency, presentmentCurrency })`

If a shared package is introduced by the backend/shared engineer, the frontend should consume that instead of keeping a frontend-only duplicate.

## Currency Resolution Rules for Web

### Transactional screens

Priority:

1. `record.currency`
2. `org billing currency`
3. sanctioned fallback from shared/backend contract

Modules:

- finance
- invoices
- appointment finance
- services cost rendering
- inventory pricing
- medications/prescription prices
- history/timeline entries containing money

### Public pricing page

Priority:

1. backend pricing endpoint presentment currency
2. backend default pricing currency

Do not:

- hardcode `€12`
- hardcode `Price in EUR`
- do client-side FX conversion for plan prices

### Form labels

When a form is editing an amount for a given org:

- show the org currency in the label
- example: `Service charge (GBP)`

But the submitted payload must still rely on backend-supported currency fields, not local assumptions.

## Required Frontend Changes by Area

## 1. Shared frontend money utilities

Replace or refactor:

- `apps/frontend/src/app/lib/money.ts`
- local money formatting logic across feature modules

Required behavior:

- support `EUR/USD/GBP`
- preserve decimals when needed
- do not force `en-US` universally
- allow locale override when needed
- handle negative amounts and zero correctly
- allow formatting for chart tick labels and compact displays

Additional requirement:

- keep a compact formatter if widgets need abbreviated values like `£5K`, but do not overload the default money formatter with chart-specific rules

## 2. Billing hook behavior

Current issue:

- `useCurrencyForPrimaryOrg()` falls back to `USD`

Target:

- use a shared supported-currency resolver
- avoid silent inline `USD` fallback
- follow the authoritative org billing currency provided by backend state

This hook should remain useful for:

- forms tied to org-configured pricing
- non-record-specific UI

It must not override record currency on invoices and payments.

## 3. Pricing page

Files currently affected:

- `apps/frontend/src/app/features/marketing/pages/PricingPage/data.ts`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingPage.tsx`
- likely `apps/frontend/src/app/ui/widgets/Upgrade/index.tsx`

Required end state:

- pricing content is driven by backend pricing response, not static embedded money strings
- monthly/yearly toggles use backend-returned exact presentment amounts
- copy reflects current display currency dynamically or avoids a fixed-currency label entirely
- UK users see `GBP`
- US users see `USD`
- EU/default users see `EUR`

Implementation notes:

- keep plan copy, feature table, and CTA layout separate from pricing value data
- move monetary values out of static content objects that currently store strings like `€12`
- store numeric amount + currency separately, then format at render time

## 4. Finance module

Areas to update:

- invoice details
- invoice tables
- invoice cards
- payment action surfaces
- finance overview widgets

Rules:

- render each invoice using `invoice.currency`
- never render invoice totals using only primary org currency if the invoice already has its own currency
- refund amounts, tax, subtotal, discount, and total must all use the same invoice currency

## 5. Appointment module

Areas to inspect and migrate:

- appointment finance summary/details
- appointment prescription/service cards
- medications and care-plan pricing
- payment-related actions and summaries

Rules:

- service cost must render from the service or appointment financial record currency
- payment summary must render from invoice/payment record currency
- any label that currently says `Cost (USD)` must derive from the org or record context

## 6. Inventory module

Areas already identified:

- inventory table
- inventory card
- inventory payload builder
- add/edit inventory forms
- inventory info/details previews

Rules:

- no literal `$`
- purchase cost, selling price, and total value must format through shared utility
- if inventory items have `currency` from API, render that
- if create/update forms do not yet expose currency selection in web, they should at minimum use org billing currency and stop forcing `USD`

## 7. Services and specialties

Areas:

- organization specialties/service charge forms
- service cards
- service info screens
- appointment booking views that show service price

Rules:

- form labels should reflect org currency
- rendered service prices should use service record currency if present
- do not assume web and mobile pricing labels can diverge

## 8. Dashboard and stats widgets

Areas:

- revenue widgets
- leaderboards
- charts
- analytics cards

Rules:

- use a currency-aware formatter for display
- if values are cross-record aggregated, use the currency provided by backend analytics response
- do not assume `USD`

If backend analytics are not yet currency-safe, the frontend should avoid masking that with fake conversion logic.

## 9. Companion history, patient overview, templates, forms

Areas to review:

- companion history timeline/card formatters
- patient or companion overview surfaces that show spend/cost
- templates/forms where price or cost fields are displayed
- medication and prescription line item UI

Rules:

- use record currency when available
- do not reuse org billing fallback where payload already includes currency

## 10. UI copy cleanup

Replace copy patterns like:

- `Price in EUR`
- `USD`
- `$`

Only keep explicit code labels where product meaning requires it.

Preferred patterns:

- currency symbol for obvious UI totals
- `GBP 120.00` style only where more explicit formatting is needed

## Frontend Data Contract Expectations

The frontend implementation assumes backend will provide:

- invoice currency
- service currency where relevant
- inventory item currency where relevant
- pricing page presentment amounts and currency
- org billing currency in billing/subscription state

If the backend contract is incomplete in some flows, frontend should not invent currency. It should surface the backend gap to the owner of the backend document.

## Migration Order

Recommended implementation order for web:

1. create shared/frontend currency formatting layer
2. replace literal `$` and local money formatters
3. fix billing/org currency hook behavior
4. migrate finance and appointment financial views
5. migrate inventory
6. migrate services/specialties and org forms
7. migrate dashboard/history/widgets
8. switch pricing page to backend-driven presentment data
9. remove obsolete hardcoded money strings and duplicate helpers

## Test Plan

### Utility tests

Add or update tests for:

- formatting `EUR`
- formatting `USD`
- formatting `GBP`
- zero values
- negative values
- decimal values
- invalid currency fallback behavior

### Pricing page tests

Test:

- UK audience response renders `GBP`
- US audience response renders `USD`
- EU/default renders `EUR`
- monthly/yearly toggle shows backend-provided values
- no hardcoded EUR strings remain in rendered price values

### Finance and appointments

Test:

- invoice card/table render invoice currency
- appointment finance summary uses record currency
- refund and total display correctly
- service cost labels use correct currency

### Inventory

Test:

- inventory table/card uses formatter, not literal `$`
- total value respects item currency
- payload builder no longer forces `USD`

### Regression tests

Search-based acceptance before handoff:

- no value-rendering code paths should still build money with `$ ${...}`
- no active UI value components should hardcode `€12`, `€10`, `USD`, or `EUR` for transactional values

## Acceptance Criteria

Frontend web work is complete when:

- all hardcoded money rendering in value paths is removed
- transactional values render from record currency when available
- org currency is used only where appropriate
- pricing page presentment is backend-driven and supports `EUR/USD/GBP`
- UK audience sees `GBP` on pricing surfaces
- no frontend code is performing charge conversion for Stripe flows
- targeted tests pass for all touched areas

## Risks

### Risk: using org currency for historical records

Mitigation:

- always prefer record currency
- only use org currency as fallback where no record currency exists

### Risk: pricing page shows a currency not supported by checkout

Mitigation:

- pricing page must only render backend pricing API values

### Risk: chart/compact formatter requirements diverge

Mitigation:

- keep chart compact formatting separate from the main money formatter

## Handoff Notes

When coordinating with backend/Stripe engineer:

- do not proceed with frontend pricing page final wiring until the pricing endpoint contract is finalized
- confirm the exact field names and casing for all currency-bearing DTOs
- treat any missing transactional currency in backend payloads as a contract issue, not something to patch with browser guesses
