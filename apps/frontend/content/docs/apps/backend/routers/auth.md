---
id: backend-api-auth
title: Auth API
slug: /apps/backend/api/auth
---

Provider-neutral session and MFA (multi-factor authentication) endpoints shared by both products. `/me` and `/logout` return and end a normalized session regardless of which underlying provider issued it; the `/mfa/*` routes manage TOTP (time-based one-time password) enrollment for the signed-in user. The whole router answers `503` with `{ message: "Authentication service is not enabled" }` if no auth provider is configured for this environment. The TOTP debug-device route is only ever registered when the process is running as an explicitly-flagged local development environment — it is structurally absent, not just permission-gated, everywhere else.

**Endpoints**

### GET /me

- Auth: `requireAnyAuth`
- Controller: inline handler in `auth.router.ts`
- Response: `200`: keys `userId`, `authProfile`, `loginMethod`, `email`, `emailVerified`, `mfa`, `firstName`, `lastName`, `role`, `roles`, `503`: keys `message`

### POST /logout

- Controller: inline handler in `auth.router.ts`
- Response: `200`: keys `status`, `503`: keys `message`

### GET /mfa/status

- Auth: `requireAuth()`
- Controller: `MfaController.status`
- Response: `200`: keys `status`, `mfa`, `500`: keys `status`, `message`

### POST /mfa/totp/enable

- Auth: `requireAuth()`
- Controller: `MfaController.enableTotp`
- Response: `200`: keys `status`, `mfa`, `500`: keys `status`, `message`

### POST /mfa/totp/disable

- Auth: `requireAuth()`
- Controller: `MfaController.disableTotp`
- Response: `200`: keys `status`, `mfa`, `500`: keys `status`, `message`

### POST /mfa/totp/debug/create-device

- Auth: `requireAuth()`
- Controller: `MfaDebugController.createTotpDevice`
- Response: `200`: JSON (created TOTP device), `500`: keys `status`, `message`, `error`

Only registered when the server process is running as an explicitly-flagged local development environment (`isLocalDevEnvironment()`); the controller also re-checks the same flag and throws if it is ever reached outside local dev.
