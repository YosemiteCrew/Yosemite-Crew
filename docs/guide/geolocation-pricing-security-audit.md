# Geolocation-Aware Pricing — Security Audit & Fixes

**Date:** 2026-04-13
**Scope:** `feat/geolocation-pricing` branch — backend + frontend pricing feature

---

## Summary

A security audit was performed on the geolocation-aware pricing feature covering
both backend (Express/Node) and frontend (Next.js/React) code. **10 findings**
were identified and all have been resolved.

| #   | Severity | Finding                                                   | Status |
| --- | -------- | --------------------------------------------------------- | ------ |
| 1   | HIGH     | Cache poisoning via incomplete `Vary` header              | Fixed  |
| 2   | MEDIUM   | Log injection via unsanitized header value                | Fixed  |
| 3   | MEDIUM   | No input length bound on currency header                  | Fixed  |
| 4   | MEDIUM   | Zustand persist hydration bypasses currency validation    | Fixed  |
| 5   | MEDIUM   | Backend `currencySymbol` trusted blindly on frontend      | Fixed  |
| 6   | MEDIUM   | Backend `buttonSrc` rendered as `href` without validation | Fixed  |
| 7   | LOW      | `source` field leaks detection method to client           | Fixed  |
| 8   | LOW      | Consent gate bypass when user denied but picks currency   | Fixed  |
| 9   | LOW      | Error message may expose internal API details             | Fixed  |
| 10  | LOW      | Structured error logging in controller                    | Fixed  |

---

## Finding 1 — Cache Poisoning (HIGH)

**Location:** `apps/backend/src/controllers/web/pricing.controller.ts`

**Issue:** The response set `Cache-Control: public, max-age=300` unconditionally.
When no `X-Preferred-Currency` header is sent, the pricing response varies by the
visitor's IP (via geoip lookup). The `Vary` header only listed
`X-Preferred-Currency`, so a CDN would consider IP-based responses
cache-equivalent and serve a cached USD response to a UK visitor.

**Fix:** Dynamic `Cache-Control` based on currency resolution source:

- `override` or `default` source: `public, max-age=300` (safe to CDN-cache,
  keyed on the `Vary: X-Preferred-Currency` header)
- `ip` source: `private, no-store` (response varies by client IP which CDNs
  cannot key on)

---

## Finding 2 — Log Injection (MEDIUM)

**Location:** `apps/backend/src/middlewares/validateCurrencyHeader.ts:36-38`

**Issue:** The debug log interpolated the raw `candidate` value directly into the
message string. After `.trim().toUpperCase()`, the value could still contain
embedded `\r\n` or ANSI escape codes, enabling log forging/CRLF injection.

**Fix:** Changed to structured logging with Winston (object field instead of
string interpolation). The candidate value is also stripped of non-printable
characters via `candidate.replace(/[^\x20-\x7E]/g, "")`.

---

## Finding 3 — No Header Length Bound (MEDIUM)

**Location:** `apps/backend/src/middlewares/validateCurrencyHeader.ts:31`

**Issue:** No length guard on the raw header value before processing. A malicious
client could send a 16 KB `X-Preferred-Currency` header, causing
`.trim().toUpperCase()` to allocate and process the entire string before the
`Set.has()` check rejects it.

**Fix:** Added early-exit length check: `raw.length <= 5` (a 3-letter currency
code plus possible whitespace). Oversized headers are silently ignored.

---

## Finding 4 — Persist Hydration Bypass (MEDIUM)

**Location:** `apps/frontend/src/app/stores/currencyStore.ts`

**Issue:** The `setPreferred` action validates against the `SUPPORTED` set, but
zustand's `persist` hydration deserializes JSON from `localStorage` and merges it
directly into state — bypassing the validation. A tampered localStorage value
(e.g. via XSS on the same origin) could inject an arbitrary string into state,
which would then be sent as the `X-Preferred-Currency` HTTP header.

**Fix:** Added `onRehydrateStorage` callback that validates `state.preferred`
against the `SUPPORTED` set on hydration, resetting to `null` if invalid.
Additionally, the axios interceptor now validates against a `VALID_CURRENCIES`
set before attaching the header (defense-in-depth).

---

## Finding 5 — Untrusted `currencySymbol` (MEDIUM)

**Location:** `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingPage.tsx`

**Issue:** The `currencySymbol` field from the backend API response was rendered
directly in the DOM. If the backend were compromised or the response tampered
with, an attacker could inject misleading content (e.g. a long string that
appears inline with prices, creating UI spoofing opportunities).

**Fix:** Currency symbol is now derived client-side from a hardcoded
`CURRENCY_SYMBOLS` map keyed by the `currency` code. The backend `currencySymbol`
field is ignored.

---

## Finding 6 — Untrusted `buttonSrc` (MEDIUM)

**Location:** `apps/frontend/src/app/features/marketing/pages/PricingPage/PricingPage.tsx`

**Issue:** `plan.buttonSrc` from the backend was used directly as `<Link href>`.
A compromised backend could set this to `javascript:` URIs or external phishing
URLs.

**Fix:** Added `safeHref()` helper that validates the value starts with `/` or
`#` (relative path). Any other value falls back to `/signup`.

---

## Finding 7 — `source` Field Information Leak (LOW)

**Location:** `apps/backend/src/services/pricing.service.ts`

**Issue:** The API response included `"source": "override" | "ip" | "default"`,
revealing the detection method to clients. This aids reconnaissance — an attacker
could confirm `X-Forwarded-For` spoofing worked, or enumerate which IPs resolve
to which countries.

**Fix:** Removed the `source` field from the public API response. The source is
still available internally (returned by `resolveCurrency()`) for cache-control
logic, but never exposed to clients. The `CurrencySource` type was also removed
from frontend types.

---

## Finding 8 — Consent Gate Bypass (LOW)

**Location:** `apps/frontend/src/app/hooks/usePricing.ts:37`

**Issue:** The consent gate condition was
`consentStatus === 'granted' || preferred !== null`. A user who explicitly
**denied** consent could still trigger the pricing API request (which performs
IP-based geolocation — processing personal data) by clicking a currency button.

**Fix:** Adjusted condition to:
`consentStatus === 'granted' || (preferred !== null && consentStatus !== 'denied')`

This respects the user's explicit denial while still allowing currency selection
when consent is `unknown` (not yet prompted).

---

## Finding 9 — Error Message Leaks Internals (LOW)

**Location:** `apps/frontend/src/app/hooks/usePricing.ts:55`

**Issue:** The error handler stored `err.message` from axios errors, which can
include the full request URL, status codes, and response body fragments. While
not currently rendered, any future consumer displaying the `error` field would
leak internal API paths.

**Fix:** Always uses the generic `'Unable to load pricing'` message for
user-facing state. Detailed error information is only sent to the logger.

---

## Finding 10 — Structured Error Logging (LOW)

**Location:** `apps/backend/src/controllers/web/pricing.controller.ts:28-29`

**Issue:** `logger.error("Error getPricing:", err)` passed the entire error object
to Winston, which could serialize sensitive data if `err` contained request
context.

**Fix:** Now logs only `message` and `stack` properties:

```ts
logger.error('Error getPricing:', { message: error.message, stack: error.stack });
```

---

## Verified Safe (No Action Required)

The following areas were audited and confirmed properly handled:

- **Allowlist validation:** `SUPPORTED_CURRENCIES` Set uses only uppercase ASCII.
  Unicode tricks via `toUpperCase()` cannot produce "USD", "GBP", or "EUR".
- **Prototype pollution via `COUNTRY_TO_CURRENCY`:** Map is `Object.freeze()`'d.
  Keys like `__proto__` return `undefined` and fall through to default.
- **geoip-country safety:** Local MaxMind database lookup (no network call),
  wrapped in try/catch. Handles malformed IPs gracefully.
- **Rate limiting:** Two layers — global 500/15min + endpoint-specific 30/min.
- **`x-powered-by` disabled** globally.
- **Express header array handling:** Code checks `typeof raw === "string"`,
  correctly rejecting duplicate header arrays.
- **React auto-escaping:** All backend values rendered via JSX text
  interpolation, not `dangerouslySetInnerHTML`.
- **Race conditions in usePricing:** Uses `cancelled` flag pattern tied to
  useEffect cleanup.
- **FALLBACK_PLANS:** Compile-time constant with hardcoded values, not
  manipulable at runtime.

---

## Deployment Notes

- **`trust proxy` setting:** Currently set to `1` in `app.ts`. This assumes
  exactly one reverse proxy in front of the Express server. Verify this matches
  the production deployment topology. If behind Cloudflare or similar, consider
  using their proprietary real-IP header.
- **Production CORS:** The CORS middleware only applies when
  `LOCAL_DEVELOPMENT` is set. Verify that the production infrastructure (reverse
  proxy, CDN, or API gateway) handles CORS and includes
  `X-Preferred-Currency` in `Access-Control-Allow-Headers`.
