# Geolocation-Aware Pricing — Implementation Notes

**Status:** implemented
**Scope:** `apps/backend` + `apps/frontend`
**Author:** Claude Code (agent run, 2026-04-10)

## 1. Problem & Goal

The public `/pricing` page rendered hardcoded EUR prices (`€0`, `€10`, `Price in EUR`). We wanted:

1. Visitors to see prices in their **local currency** (USD, GBP, or EUR).
2. Prices to come from the **backend** (single source of truth), not hardcoded on the frontend.
3. Geolocation to happen **only after cookie consent** (GDPR lawful basis).
4. Anything outside the three supported currencies to fall back to **USD**.
5. The solution to be **secure, defensive, and industry-standard** — not the naive "client sends a header, backend trusts it" shape.

## 2. Architecture Overview

```
Visitor hits /pricing
  │
  ├── Cookie consent NOT granted AND no manual override
  │     → Frontend shows USD fallback (FALLBACK_PLANS). No network call.
  │
  ├── User clicks "Accept" on Cookies widget
  │     → consentStore.grant() persists to localStorage.cookieConsentGiven
  │     → usePricing() fires GET /v1/pricing WITHOUT X-Preferred-Currency
  │     → Backend reads req.ip (trust proxy: 1), runs geoip-country lookup,
  │       maps country → currency, returns plans in that currency.
  │
  └── User clicks USD/GBP/EUR in CurrencySwitcher
        → currencyStore.setPreferred("GBP") persists to localStorage
        → axios interceptor adds X-Preferred-Currency header on all requests
        → usePricing() re-fires with the header
        → Backend middleware allowlist-validates the header, overrides
          IP detection, returns plans in GBP.
```

## 3. What Got Built

### Backend — new files

| File                                                     | Purpose                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/constants/pricing.constants.ts`        | `SUPPORTED_CURRENCIES`, `CURRENCY_SYMBOLS`, `COUNTRY_TO_CURRENCY`, `PRICING_PLANS`, `DEFAULT_CURRENCY`, `PlanDTO` type. Single source of truth for plan prices.                                                                          |
| `apps/backend/src/services/geo.service.ts`               | `getCountryFromIp(ip)` — wraps `geoip-country` with IPv6/loopback handling. `resolveCurrencyFromCountry(country)` — country → currency mapping with USD fallback.                                                                        |
| `apps/backend/src/services/pricing.service.ts`           | `resolveCurrency(req, override)` — priority `override → ip → default`. `getPricingResponse(req, override)` — composes the full DTO.                                                                                                      |
| `apps/backend/src/middlewares/validateCurrencyHeader.ts` | Reads `X-Preferred-Currency`, allowlist-validates against `SUPPORTED_CURRENCIES.has()`, stashes the canonical uppercase value on `res.locals.overrideCurrency`. Never throws. Silently ignores invalid values (graceful fallback to IP). |
| `apps/backend/src/controllers/web/pricing.controller.ts` | Public `GET /v1/pricing` handler. Sets `Cache-Control: public, max-age=300` + `Vary: X-Preferred-Currency` response headers.                                                                                                             |
| `apps/backend/src/routers/pricing.router.ts`             | Mounts the controller under a dedicated per-IP rate limiter (30 req/min).                                                                                                                                                                |

### Backend — modified files

- `apps/backend/src/routers/index.ts` — registered `pricingRouter` at `/v1/pricing`.
- `apps/backend/src/app.ts` — added `'X-Preferred-Currency'` to the CORS `allowedHeaders` list.
- `apps/backend/package.json` — added `geoip-country` + `@types/geoip-country` dependencies.

### Frontend — new files

| File                                                                              | Purpose                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/app/stores/consentStore.ts`                                    | Zustand store tracking cookie consent (`'unknown' \| 'granted' \| 'denied'`). Persists to `localStorage.cookieConsentGiven` (backwards-compatible key). |
| `apps/frontend/src/app/stores/currencyStore.ts`                                   | Zustand store tracking user's preferred currency. Persisted via `zustand/middleware` `persist` to `localStorage` as `currency-store`.                   |
| `apps/frontend/src/app/hooks/usePricing.ts`                                       | React hook that fetches `/v1/pricing` **only** when consent is granted or a preferred currency is set. Returns `{ data, loading, error }`.              |
| `apps/frontend/src/app/features/marketing/pages/PricingPage/types.ts`             | Shared types: `SupportedCurrency`, `PlanDTO`, `PricingResponse`, etc.                                                                                   |
| `apps/frontend/src/app/features/marketing/pages/PricingPage/CurrencySwitcher.tsx` | Accessible segmented control with `role="group"`, `aria-label`, `aria-pressed`, keyboard-navigable `<button>`s.                                         |
| `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingSkeleton.tsx`  | Loading placeholder mirroring the real card layout (no layout shift).                                                                                   |

### Frontend — modified files

- `apps/frontend/src/app/services/axios.ts` — request interceptor now attaches `X-Preferred-Currency` when `currencyStore.preferred` is set.
- `apps/frontend/src/app/ui/widgets/Cookies/Cookies.tsx` — now uses `consentStore` (`hydrate`, `grant`, `deny`) instead of direct `localStorage` reads. Behaviour unchanged from the user's POV.
- `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingPage.tsx` — replaced hardcoded `PricingPlans` with `usePricing()`; renders `PricingSkeleton` while loading; renders `CurrencySwitcher`; dynamic `Price in {currency}` label; typed helpers `formatPrice` / `getPlanPrice` extracted to module scope (Sonar ≤15 cognitive complexity).
- `apps/frontend/src/app/features/marketing/pages/PricingPage/data.ts` — removed `PricingPlans` (with EUR strings). Replaced with `FALLBACK_PLANS: PlanDTO[]` — USD-priced typed fallback used before the backend response arrives.

## 4. API Contract

### `GET /v1/pricing`

Optional request header: `X-Preferred-Currency: USD | GBP | EUR` (allowlist-validated; ignored if invalid).

Response (200):

```json
{
  "currency": "EUR",
  "currencySymbol": "€",
  "plans": [
    { "id": "free",      "amount": 0,    "amountYearly": 0,    "active": true,  "recommended": false, ... },
    { "id": "business",  "amount": 12,   "amountYearly": 10,   "active": true,  "recommended": true,  ... },
    { "id": "enterprise","amount": null, "amountYearly": null, "active": false, "recommended": false, ... }
  ]
}
```

Response headers:

- `Vary: X-Preferred-Currency` (always present).
- `Cache-Control: public, max-age=300` when currency is resolved via the header override or falls back to default USD.
- `Cache-Control: private, no-store` when currency is resolved via IP-based geolocation (cannot be CDN-cached since it varies by client IP).

## 5. Pricing Table

Prices live in `apps/backend/src/constants/pricing.constants.ts::PRICE_TABLE`:

| Plan       | USD (month) | USD (year) | GBP (month) | GBP (year) | EUR (month) | EUR (year) |
| ---------- | ----------- | ---------- | ----------- | ---------- | ----------- | ---------- |
| Free       | $0          | $0         | £0          | £0         | €0          | €0         |
| Business   | $13         | $11        | £10         | £8         | €12         | €10        |
| Enterprise | —           | —          | —           | —          | —           | —          |

Enterprise renders "Coming soon" (backend returns `null`; frontend formats as `"Coming soon"`).

## 6. Security Guarantees (Defense in Depth)

| #   | Threat                                                                     | Mitigation                                                                                                                                    |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Client forges `X-Preferred-Currency: DROP TABLE`                           | **Allowlist `Set.has()` validation.** Uppercase only. Any non-match is silently ignored. No DB lookup, no regex, no coercion.                 |
| 2   | Client spoofs source IP via `X-Forwarded-For`                              | `trust proxy: 1` is already configured in `app.ts:21`. Express only honours the **last** proxy hop.                                           |
| 3   | Scraping / abuse of the public endpoint                                    | **Dedicated per-IP rate limiter** (30/min) in `pricing.router.ts` **on top of** the global 500/15min in `app.ts`.                             |
| 4   | CDN cache poisoning across currencies                                      | `Vary: X-Preferred-Currency` response header.                                                                                                 |
| 5   | NoSQL injection                                                            | `express-mongo-sanitize` already installed globally (`app.ts:64`). Pricing endpoint uses no DB at all.                                        |
| 6   | Tracking before consent (GDPR Art. 6)                                      | **Consent gate in `usePricing`** — no network call fires until `consentStore.status === 'granted'` or a manual override is explicitly chosen. |
| 7   | PII storage                                                                | **Zero.** Country is derived transiently per request from `req.ip` and never persisted. No analytics.                                         |
| 8   | Third-party data transfer                                                  | **Offline geoip DB.** `geoip-country` ships its own DB file — no external API calls, no cross-border data transfer.                           |
| 9   | Client relying on untrusted data                                           | Frontend treats the backend response as the source of truth but falls back to `FALLBACK_PLANS` (USD) if the request fails.                    |
| 10  | CSRF                                                                       | This is a `GET` endpoint with no side effects, no cookies required, no mutating state.                                                        |
| 11  | Denial of Service via malformed header                                     | Middleware only reads strings (`typeof raw === 'string'`), trims, uppercases, and bails on length 0. No regex. No unbounded allocation.       |
| 12  | Header-injection via `X-Preferred-Currency` bleeding into response headers | Value is never echoed back. Only `Vary` has a fixed literal `X-Preferred-Currency` string.                                                    |

## 7. Industry-Standard Enhancements (vs. the "naive" version)

The original brief described a frontend-driven flow: browser Geolocation API → reverse-geocode → send currency header → backend trusts it. We upgraded that to:

- **Server-side IP geolocation** instead of browser API → no second permission prompt, no precise coordinates, GDPR-friendlier.
- **Backend as source of truth** for currency resolution → client-sent headers are _one input_ among three priority tiers, never blindly trusted.
- **Consent-gated network call** → no data sent to the backend before lawful basis exists.
- **Manual currency switcher** → fixes VPN/traveler mis-detection, improves trust, persists across sessions.
- **Accessible UI** → `role="group"`, `aria-pressed`, `aria-label`, full keyboard navigation.
- **Cache-safe response** → `Vary: X-Preferred-Currency` prevents CDN currency mix-ups.
- **Dedicated rate limiter** → scraping protection layered on top of the global limiter.
- **Skeleton loader** → no layout shift during the fetch.
- **Typed DTO contract** → `PlanDTO`/`PricingResponse` types prevent frontend/backend drift.

## 8. Implementation Steps (Chronological)

1. **Planning** — explored the codebase (cookies widget, pricing page, backend app.ts/routers, axios interceptor, store patterns) and wrote an implementation plan.
2. **Clarification** — asked three architecture questions (detection method, override UI, plan storage) and got user sign-off for: IP-based backend detection, manual switcher, hardcoded constants.
3. **Backend dependency** — `pnpm --filter backend add geoip-country @types/geoip-country`.
4. **Backend constants** — created `pricing.constants.ts` with types, currency map, price table.
5. **Backend services** — created `geo.service.ts` (geoip wrapper) and `pricing.service.ts` (currency resolution).
6. **Backend middleware** — created `validateCurrencyHeader.ts` (allowlist validation).
7. **Backend controller + router** — created `pricing.controller.ts` and `pricing.router.ts` with rate limiter. Registered in `routers/index.ts` and added to CORS `allowedHeaders` in `app.ts`.
8. **Backend type-check** — ran `pnpm --filter backend run type-check`. All new files are clean; the pre-existing errors in appointment/code/organization services are unrelated to this change.
9. **Frontend stores** — created `consentStore.ts` + `currencyStore.ts`.
10. **Frontend axios** — wired the interceptor to attach `X-Preferred-Currency` from `currencyStore`.
11. **Frontend hook** — created `usePricing.ts` with the consent gate.
12. **Frontend types** — created `PricingPage/types.ts` for shared DTOs.
13. **Frontend UI** — created `CurrencySwitcher.tsx` (accessible) and `PricingSkeleton.tsx` (loading state).
14. **Frontend Cookies widget** — refactored to use `consentStore` instead of direct `localStorage`.
15. **Frontend PricingPage** — refactored to use `usePricing`, render the switcher, skeleton, dynamic prices, and replaced `PricingPlans` import with the typed `FALLBACK_PLANS`.
16. **Verification:**
    - Frontend type-check: `cd apps/frontend && npx tsc --noemit` → 0 errors
    - Frontend lint: `pnpm --filter frontend run lint` → clean
    - Backend type-check: new files clean (pre-existing errors in other files unrelated)
    - Backend lint: clean
    - Frontend targeted tests:
      - `jest --testPathPattern="PricingPage"` → 2/2 pass
      - `jest --testPathPattern="Cookies"` → 5/5 pass
      - `jest --testPathPattern="axios"` → 21/21 pass
      - `jest --testPathPattern="stores"` → 368/368 pass
    - Dev server: `http://localhost:3003/pricing` → HTTP 200, renders "Price in USD" default + `aria-pressed` switcher buttons

## 9. Manual Verification Steps

### Happy path

1. `pnpm --filter backend run dev` (needs Firebase / Cognito env to boot locally — if missing, backend boot will error; that is unrelated to this feature).
2. `pnpm --filter frontend run dev`
3. Open the pricing page in a fresh incognito window.
4. Observe: cookie popup visible, prices in USD (fallback because consent not granted).
5. Click **Accept**. `/v1/pricing` fires. On localhost the IP lookup falls back to USD → still USD. `source: "default"`.
6. Click **GBP** on the currency switcher. New request with `X-Preferred-Currency: GBP`. Prices flip to £.
7. Reload the page. GBP preference persists via `localStorage.currency-store`.

### Negative tests

1. `curl -i -H 'X-Preferred-Currency: HACK' http://localhost:4000/v1/pricing` → returns USD (ignored) with `source: "default"` or `"ip"`.
2. `curl -i -H 'X-Preferred-Currency: eur' http://localhost:4000/v1/pricing` → returns EUR (case-insensitive).
3. `for i in {1..40}; do curl -s -o /dev/null -w "%{http_code} " http://localhost:4000/v1/pricing; done; echo` → expect `429` after 30 requests.
4. Response should include `Vary: X-Preferred-Currency` and `Cache-Control: public, max-age=300` headers.

## 10. Files Touched (Quick Index)

**Backend — created**

- `apps/backend/src/constants/pricing.constants.ts`
- `apps/backend/src/services/geo.service.ts`
- `apps/backend/src/services/pricing.service.ts`
- `apps/backend/src/middlewares/validateCurrencyHeader.ts`
- `apps/backend/src/controllers/web/pricing.controller.ts`
- `apps/backend/src/routers/pricing.router.ts`

**Backend — modified**

- `apps/backend/src/routers/index.ts`
- `apps/backend/src/app.ts`
- `apps/backend/package.json`

**Frontend — created**

- `apps/frontend/src/app/stores/consentStore.ts`
- `apps/frontend/src/app/stores/currencyStore.ts`
- `apps/frontend/src/app/hooks/usePricing.ts`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/types.ts`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/CurrencySwitcher.tsx`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingSkeleton.tsx`

**Frontend — modified**

- `apps/frontend/src/app/services/axios.ts`
- `apps/frontend/src/app/ui/widgets/Cookies/Cookies.tsx`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingPage.tsx`
- `apps/frontend/src/app/features/marketing/pages/PricingPage/data.ts`

## 11. Out of Scope (Future Work)

- Adding `helmet` middleware to the backend for broader security headers.
- Plumbing the selected currency through Stripe checkout (the billing model already has a `currency` field).
- `Intl.NumberFormat`-based locale-aware number formatting (e.g. `€1.200,00` vs `€1,200.00`).
- Unit tests for the three new backend files (`geo.service`, `pricing.service`, `validateCurrencyHeader`) — the integration tests via the PricingPage route exercise the happy path, but isolated backend jest tests would add coverage.
- MongoDB-backed plan CMS — if marketing wants to change prices without redeploy.

## 12. Commit Checkpoint (suggested)

Per the repo's commit discipline rule, the agent never commits. Suggested message when the user is ready:

```
feat(repo): add geolocation-aware pricing with cookie consent gate

- Add public GET /v1/pricing backend endpoint with IP-based currency
  detection (geoip-country), allowlist header validation, dedicated
  rate limiter, and Cache-Control/Vary response headers.
- Add consentStore and currencyStore on the frontend; gate the
  /v1/pricing fetch on consent; add accessible currency switcher
  and loading skeleton on the pricing page.
- Replace hardcoded EUR prices with dynamic values from the backend;
  keep USD FALLBACK_PLANS for the pre-consent render path.
```

Scope is `repo` because the change spans both `frontend` and `backend` workspaces.
