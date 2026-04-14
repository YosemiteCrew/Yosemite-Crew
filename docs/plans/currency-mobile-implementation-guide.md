# Mobile Currency Modernization Guide

## Objective

Upgrade `apps/mobileAppYC` from its current partial `EUR/USD` support to a production-grade `EUR/USD/GBP` currency system aligned with backend truth and web behavior.

This document is only for `apps/mobileAppYC`.

The backend and Stripe implementation details live in:

- `docs/plans/currency-backend-stripe-implementation-guide.md`

The web implementation details live in:

- `docs/plans/currency-frontend-web-implementation-guide.md`

## Scope

This guide covers:

- mobile currency utilities and preference handling
- appointment/payment/expense UI behavior
- mobile-specific migration tasks
- tests and rollout checks

This guide does not cover:

- backend persistence logic
- Stripe price configuration
- web pricing page implementation

## Supported Currencies

Phase 1 supported currencies:

- `EUR`
- `USD`
- `GBP`

Required audience defaults:

- UK => `GBP`
- US => `USD`
- EU/default => `EUR`

## Current Mobile State

Mobile is ahead of web in one important way:

- it already has shared currency utility concepts

But it is not yet production-ready for this rollout because:

- current support is limited to `EUR | USD`
- several screens manually concatenate symbol + amount
- many flows still default to `'USD'`
- local preference and heuristic business resolver logic are not authoritative enough for production

Key files already identified:

- `apps/mobileAppYC/src/shared/utils/currency.ts`
- `apps/mobileAppYC/src/shared/utils/currencyResolver.ts`
- `apps/mobileAppYC/src/shared/hooks/useCurrencyPreference.ts`
- payment, appointment, home, expense, and profile screens

## Mobile Principles

### 1. Backend truth wins for transactional money

For:

- invoices
- payment intents
- expenses
- appointment-related money
- services returned from backend

The app must render the currency provided by the backend record whenever available.

Do not:

- convert transactional values client-side
- override invoice/payment currency with local preference
- use currency preference to determine Stripe charge currency

### 2. Preference is display convenience, not authority

The mobile currency preference can be used for:

- optional display defaults where no authoritative record currency exists
- onboarding/profile preferences if product wants this

It must not override:

- invoice currency
- payment intent currency
- org billing currency
- backend-presented service or expense currency

### 3. Utility centralization must improve, not fork

Mobile should not remain a separate currency implementation with its own supported-currency assumptions.

If a shared package is introduced:

- consume shared currency metadata and normalization rules
- keep only thin mobile wrappers where AsyncStorage or RN-specific behavior is needed

## Required Mobile Architecture

## Currency domain

Mobile should ultimately use the same supported currency registry as web/backend for:

- supported codes
- symbols
- fraction digits
- country mapping
- normalization rules

Minimum required mobile changes:

- expand current `CurrencyCode` to include `GBP`
- update supported currency list
- update symbol resolution
- update formatting helpers
- remove comments and warnings that still state “EUR and USD only”

## Resolution rules

### Transactional views

Priority:

1. record currency from API
2. org or business currency from backend-owned context
3. sanctioned fallback only where backend does not provide currency

### Non-transactional optional display

Priority:

1. explicit backend-provided display currency
2. stored user preference
3. country-derived default

## Required Mobile Changes by Area

## 1. Shared mobile currency utilities

Files to update:

- `apps/mobileAppYC/src/shared/utils/currency.ts`
- `apps/mobileAppYC/src/shared/utils/currencyResolver.ts`
- `apps/mobileAppYC/src/shared/hooks/useCurrencyPreference.ts`
- any `currencyList` filtering logic tied to only EUR/USD

Required changes:

- support `GBP`
- normalize lowercase and mixed-case inputs
- format `GBP` via `Intl.NumberFormat`
- preserve fallback formatting if locale formatting fails
- update warnings, comments, and tests

Specific cleanup:

- remove logic or comments that say “Only supports EUR and USD”
- stop defaulting unsupported inputs directly to `USD` unless that remains the centrally approved fallback

## 2. Currency preference behavior

Current preference storage is local and limited to `EUR/USD`.

Required changes:

- allow `GBP`
- treat preference as optional display preference only
- do not leak preference into transactional rendering where record currency exists

If backend later stores preference centrally, mobile can sync to it. That is not required for phase 1 unless the backend owner chooses to implement it.

## 3. Appointment flows

Areas to update:

- booking form
- edit appointment
- service price chips and accordions
- appointment summary cards
- appointment-related finance renderers

Rules:

- if service currency exists, use it
- if payment or invoice currency exists, use that
- remove manual `resolveCurrencySymbol(currency) + amount` patterns where a proper formatter should be used

### Example risk

Current UI patterns like:

- `£`/`$`/`€` symbol plus raw number

can create inconsistent decimal handling and localization. Replace with shared formatter output.

## 4. Payment flows

Areas:

- payment invoice screen
- payment success screen
- invoice/payment summaries
- refund amount displays

Rules:

- use `invoice.currency` or `paymentIntent.currency`
- `GBP` must render correctly everywhere
- refund and line item prices must format through one money utility

Do not:

- fall back to `'USD'` unless there is no authoritative currency
- manually assemble receipt totals with symbols

## 5. Expense flows

Areas:

- add expense
- edit expense
- expense list
- expense preview
- home/summary expense widgets

Rules:

- allow `GBP`
- if backend sends expense currency, render it directly
- summary screens should not override expense currency with user preference unless the backend explicitly defines summary currency that way

## 6. Home and dashboard cards

Areas:

- yearly spend card
- home screen summaries
- notification or summary cards if they show amounts

Rules:

- display the backend-provided summary currency when present
- use preference only as fallback for non-authoritative UI

## 7. Account/profile flows

Areas:

- create account defaults
- edit parent/account profile
- currency selection bottom sheet
- auth/profile types where currency is stored

Rules:

- add `GBP`
- update selection UI and labels
- ensure profile editing no longer assumes only `EUR/USD`

## 8. Adverse event and other forms

Any flow that sends or displays currency must be reviewed.

Already identified:

- adverse event reporting includes user currency fallback

Target:

- support `GBP`
- centralize supported currency selection

## Mobile UX Requirements

### Display behavior

Use:

- localized currency formatter for visible money values
- explicit symbol or code only when the formatter is insufficient

### Input behavior

For amount inputs:

- keep numeric input separate from currency label/selector
- do not allow the displayed symbol to become the stored value
- if currency is org-owned or backend-owned, display it as contextual label rather than free text

## API Contract Expectations

The mobile implementation assumes backend will provide currency where money exists in:

- invoices
- payment intents
- service pricing
- expense records and summaries where appropriate

Mobile should not paper over missing backend currency by inventing a better one from local preference if the backend contract is incomplete.

## Migration Order

Recommended implementation order:

1. extend shared mobile currency utilities to `GBP`
2. update preference and selection components
3. replace manual symbol concatenation in payment and appointment screens
4. update expense screens and summary cards
5. update home/dashboard spend renderers
6. update profile/account flows
7. remove stale `USD` fallbacks and comments

## Test Plan

### Utility tests

Add or update tests for:

- `GBP` support in supported currency list
- symbol resolution for `GBP`
- locale formatting for `GBP`
- normalization of mixed-case inputs
- preference persistence for `GBP`

### Appointment and payment tests

Test:

- booking/service cost badges render `GBP`
- payment invoice screen renders `GBP`
- refund amount rendering uses formatter output
- invoice line items display `GBP` correctly

### Expense tests

Test:

- add/edit/list/preview screens support `GBP`
- summaries render backend or record currency correctly

### Profile/preference tests

Test:

- currency selector shows `GBP`
- stored preference round-trips correctly
- unsupported-currency warnings/messages are updated

## Acceptance Criteria

Mobile work is complete when:

- `GBP` is fully supported across utility, preference, and UI layers
- transactional views always respect record currency
- user preference does not override invoice/payment currency
- manual symbol concatenation is removed from primary money-rendering paths
- stale `USD`-only and `EUR/USD`-only assumptions are removed
- targeted tests pass

## Risks

### Risk: mobile preference conflicts with backend truth

Mitigation:

- record currency always wins
- preference is only a fallback for non-authoritative display contexts

### Risk: web and mobile diverge again

Mitigation:

- use shared currency metadata and supported-code rules wherever possible

### Risk: hidden `'USD'` fallbacks remain

Mitigation:

- search for `'USD'`, `'EUR'`, `'GBP'`, `$`, `€`, `£`, and manual symbol concatenation patterns before handoff

## Handoff Notes

Coordinate with backend owner on:

- final supported currency casing
- which API responses are guaranteed to include currency
- whether any summary endpoints intentionally return org-level summary currency

Coordinate with web owner on:

- shared supported currency list
- shared naming for helper functions and resolver semantics
