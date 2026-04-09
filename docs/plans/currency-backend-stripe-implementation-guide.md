# Backend and Stripe Currency Modernization Guide

## Objective

Create the backend and Stripe architecture that supports a clean `EUR/USD/GBP` rollout across the platform without breaking invoices, appointment payments, inventory pricing, expenses, subscriptions, or public pricing presentment.

This document is for:

- backend engineer
- Stripe/billing engineer
- anyone touching shared data contracts

This document is not focused on frontend or mobile implementation detail beyond API and contract expectations.

Related documents:

- `docs/plans/currency-frontend-web-implementation-guide.md`
- `docs/plans/currency-mobile-implementation-guide.md`

## Scope

This guide covers:

- backend source-of-truth currency rules
- shared money and currency contract design
- organization billing currency defaults
- transactional record currency handling
- Stripe subscription and payment integration
- pricing presentment endpoint
- migration strategy
- testing and rollout expectations

## Supported Currencies

Phase 1 supported currencies:

- `EUR`
- `USD`
- `GBP`

Required country defaults:

- UK => `GBP`
- US => `USD`
- EU/default => `EUR`

## Non-Negotiable Principles

### 1. Backend owns currency truth

The backend must be the source of truth for:

- org billing currency
- invoice currency
- payment intent currency
- service currency where relevant
- inventory item currency
- expense currency
- public pricing presentment amount/currency returned to clients

Clients must not decide charge currency.

### 2. No client-side FX for operational money

Do not allow frontend/mobile to convert:

- invoice totals
- payment amounts
- inventory values
- services
- expenses

If cross-currency analytics are needed later, implement a dedicated reporting conversion layer separately.

### 3. Stripe display and Stripe charge must match

Public plan prices shown to users must come from the same configured pricing source used for Stripe checkout.

Do not:

- show locally converted pricing on the frontend
- keep pricing page amounts as hardcoded content
- expose a marketing price that Stripe cannot actually charge

## Current Backend State

### Existing strengths

- org billing currency helper already exists in `apps/backend/src/utils/billing.ts`
- invoice and Stripe services already pass currency through several flows
- inventory and expense services already carry currency fields in some places

### Existing problems

- raw inline fallbacks to `USD`/`usd` still exist
- defaulting behavior is scattered instead of centralized
- email/history text sometimes constructs currency strings manually
- no documented precedence rules for record currency vs org currency vs default
- no backend pricing presentment API for the public pricing page
- Stripe subscription pricing is still env-price-ID-centric rather than a documented multi-currency presentment system

## Target Backend Architecture

## 1. Shared currency contract

Create or standardize one shared currency domain for the monorepo.

Minimum shared definitions:

- `SupportedCurrencyCode = 'EUR' | 'USD' | 'GBP'`
- supported currency validator
- normalization helper
- country-to-default-currency resolver
- currency metadata
- money shape guidance

Recommended metadata:

- `code`
- `symbol`
- `fractionDigits`
- `displayName`
- `stripeCode`
- `defaultLocaleHint`

### Money shape guidance

Preferred pattern:

- `{ amount: number, currency: SupportedCurrencyCode }`

Where legacy DTOs already separate fields:

- keep backward compatibility if needed
- but normalize all services to treat money as amount + currency together

## 2. Currency precedence rules

These rules must be implemented centrally and documented.

### Organization default/billing currency

Priority:

1. explicit org billing currency
2. org country-derived currency
3. approved system fallback

Recommended system fallback for new-org baseline:

- `EUR`

Legacy fallback:

- only use `USD` in narrowly approved legacy paths if required for compatibility
- all such usage should route through one centralized helper, not inline literals

### Transactional records

When creating records with money:

- use explicit incoming supported currency if the flow allows it and it is valid
- otherwise use org billing currency
- otherwise use org country-derived default
- otherwise use centralized fallback

Examples:

- invoice creation => org billing currency unless explicitly overridden by supported business rule
- service creation => org billing currency
- inventory item create/update => org billing currency
- expense create/update => explicit validated currency or org billing currency
- payment intent for invoice => invoice currency
- payment intent for appointment/service => org billing/service currency

### Display/notification formatting

When constructing text:

- format from record currency
- never assume `USD`

Applies to:

- emails
- notifications
- audit trail summaries
- companion history summaries

## 3. Organization currency model

Add or standardize a backend helper such as:

- `resolveOrgBillingCurrency(orgId)`
- `resolveDefaultCurrencyFromCountry(country)`
- `validateSupportedCurrency(input)`

Country mapping rules for phase 1:

- if org country is UK or equivalent normalized variant => `GBP`
- if org country is US => `USD`
- if org country is in supported EU list => `EUR`
- otherwise => `EUR`

Normalization expectations:

- backend should normalize country names/codes before resolution
- avoid fuzzy frontend-only heuristics as the authoritative rule

## Required Backend Changes by Domain

## 1. Billing and org currency utilities

Files likely affected:

- `apps/backend/src/utils/billing.ts`
- billing-related services
- organization services
- any shared helper package introduced for currency

Required changes:

- centralize all supported-currency validation
- centralize all default/fallback logic
- stop returning raw inconsistent casing
- define whether API uses uppercase or lowercase externally and apply consistently

Recommendation:

- API contracts to frontend/mobile should use uppercase codes: `EUR/USD/GBP`
- Stripe adapter layer may lowercase when sending to Stripe

## 2. Organization creation and updates

Organization or billing data must support:

- explicit billing currency storage
- country-based default when billing currency is absent

Required behavior:

- new orgs without explicit billing currency derive it from country
- existing orgs with explicit billing currency keep it
- existing orgs without billing currency resolve via country/fallback without breaking existing behavior

## 3. Service pricing

Service creation/update must:

- stamp currency explicitly
- default to org billing currency if not provided
- return currency in service DTOs where price is returned

This is important because both web and mobile appointment/service flows show service prices.

## 4. Inventory

Inventory service must:

- stop relying on web hardcoded `USD`
- persist item currency explicitly
- default to org billing currency
- return item currency in fetch/list/detail endpoints

Any update flow that changes or re-saves inventory should preserve stored currency unless there is an explicit supported change path.

## 5. Expenses

Expense service must:

- validate incoming currency against supported set
- avoid scattered `USD` fallbacks
- default centrally if needed
- ensure summary endpoints return explicit summary currency

If summary endpoints aggregate expenses with mixed currencies, that must be handled explicitly. Do not silently sum different currencies together without a defined rule.

Phase 1 recommendation:

- keep expense summaries in org currency only if data is guaranteed same-currency
- otherwise defer multi-currency reporting to a later reporting layer

## 6. Invoices

Invoice service must:

- always stamp invoice currency on creation
- preserve invoice currency across updates
- ensure line items and totals are interpreted in invoice currency
- expose invoice currency consistently to all clients

Text-generation cleanup required:

- email amount text
- notification summaries
- timeline/history summaries

These must use formatter helpers and the invoice’s own currency.

## 7. Appointment payments

Appointment payment intent flows must:

- use authoritative org/service/payment currency
- pass validated currency to Stripe
- return currency to clients clearly

No client should need to infer currency from amount context alone.

## 8. Companion history / audit / notifications

Any summary payload that includes amount text must:

- format with record currency
- avoid manual string patterns like `USD 100.00` built inline in service methods

If history payloads include raw `amount` and `currency`, keep that and let clients format visually. If preformatted strings remain necessary, they still must derive from centralized formatting rules.

## Stripe Strategy

## 1. Subscription pricing

Recommended approach:

- configure Stripe product/prices for exact `EUR/USD/GBP` presentment amounts
- use multi-currency price support or currency options where compatible with the current checkout approach
- ensure all related prices share a compatible default currency

Required monthly/yearly coverage:

- business monthly `EUR/USD/GBP`
- business yearly `EUR/USD/GBP`

The pricing page must not invent amounts. Backend should expose exact configured presentment values.

## 2. Checkout Sessions for subscriptions

Current code uses env-backed price IDs for checkout.

Target behavior:

- either continue with env-backed IDs that represent a Stripe multi-currency price, or move to a pricing configuration layer that maps interval + presentment currency safely
- make checkout session currency predictable and compatible with the displayed public price

Implementation constraint:

- do not break existing successful subscription flows while adding `GBP`

## 3. Public pricing presentment endpoint

Add a backend endpoint for public pricing page data.

Endpoint responsibilities:

- determine audience presentment currency from request context
- return exact plan amounts for monthly/yearly
- return plan metadata and presentment currency
- return fallback behavior if a requested currency is not configured

Input signals may include:

- Geo/IP or country header from infra
- locale/country hints
- safe server fallback to `EUR`

Output should include:

- `plan`
- `interval`
- `currency`
- `amount`
- `formattedAmount`
- optional `baseCurrency`
- optional `isFallback`

## 4. Payment Intents and invoice payments

Stripe payment flows must:

- use invoice or org-backed transactional currency
- validate that `EUR/USD/GBP` are supported in the phase 1 contract
- preserve charge currency through webhook and post-payment updates

Do not:

- let frontend choose a different payment currency from the record
- do client-side conversion

## 5. Stripe version review

Current code is using a Stripe API version behind the latest Stripe guidance loaded in the Stripe skill.

Before rollout:

- review current pinned Stripe version
- confirm compatibility with the chosen multi-currency pricing approach
- upgrade only if required and safe within the billing engineer’s scope

This should be treated carefully because a broad Stripe upgrade is higher risk than the currency model itself.

## API Contract Requirements

Backend responses must include currency anywhere money is returned.

Minimum required coverage:

- services with price
- inventory with purchase/selling price
- expense detail and summary
- invoice list/detail/summary
- payment intent responses
- pricing page presentment response

Contract rules:

- choose one casing for API currency values and apply it consistently
- recommended external casing: uppercase `EUR/USD/GBP`
- Stripe adapter may lowercase only at integration boundary

## Migration Strategy

## Existing orgs

Rules:

- preserve explicit stored billing currency
- derive from org country when missing
- fallback centrally when country is missing

Recommended rollout:

1. implement read-time central fallback first
2. optionally run a backfill to persist inferred billing currency later

## Existing records

Rules:

- do not retro-convert historical values
- preserve existing record currency if present
- infer missing currency only through centralized fallback logic

If records without currency are common, implementation should include:

- metrics/logging for how often inference occurs
- a later cleanup plan if needed

## Analytics and Reporting

Phase 1 does not add general FX conversion.

Rules:

- do not sum mixed currencies as if they were the same unless the dataset is guaranteed same-currency
- do not silently convert on the fly in API responses unless a reporting-specific contract exists

Future reporting layer can add:

- reporting currency
- dated FX conversion
- exchange rate source
- auditability of conversion date/rate

## Testing Requirements

## Unit/service tests

Add or update tests for:

- supported currency validation
- org country => default currency resolution
- billing currency fallback behavior
- service/inventory/expense/invoice creation currency stamping
- invoice/payment intent currency propagation
- history/notification formatting

## Stripe tests

Add or update tests for:

- subscription checkout path with configured `EUR/USD/GBP`
- payment intent creation for invoice and appointment flows
- no regression in existing checkout session generation

## Pricing endpoint tests

Test:

- UK presentment => `GBP`
- US presentment => `USD`
- EU/default => `EUR`
- missing config falls back safely
- returned values match configured Stripe-backed pricing source

## Integration/contract tests

Where possible:

- verify frontend/mobile-facing DTOs include currency everywhere money is returned
- verify casing consistency

## Acceptance Criteria

Backend/Stripe work is complete when:

- there is one centralized supported-currency/defaulting system
- `EUR/USD/GBP` are supported end to end
- org billing currency resolves cleanly from explicit value or country
- invoice, payment, inventory, service, and expense flows return authoritative currency
- Stripe subscription pricing supports exact `EUR/USD/GBP` presentment
- pricing page backend endpoint returns exact display-ready pricing data
- no critical transactional flow depends on frontend currency assumptions
- targeted backend and Stripe tests pass

## Risks

### Risk: Stripe pricing mismatch with public pricing page

Mitigation:

- pricing page must use backend endpoint sourced from the same Stripe pricing configuration

### Risk: mixed-currency summaries become incorrect

Mitigation:

- do not aggregate unlike currencies without an explicit reporting rule

### Risk: legacy fallback behavior changes unexpectedly

Mitigation:

- centralize fallback logic
- add tests around legacy no-currency cases
- log inferred currency usage during rollout

### Risk: casing inconsistencies break clients

Mitigation:

- normalize in one place
- enforce uppercase in API contracts

## Handoff Notes

Frontend/mobile engineers depend on this backend work for:

- authoritative org billing currency
- currency-bearing DTOs
- pricing page presentment endpoint
- stable currency casing rules

Any field-name or casing decision made here should be documented and communicated before frontend/mobile integration starts.
