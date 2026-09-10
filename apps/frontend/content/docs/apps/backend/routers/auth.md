---
id: backend-api-auth
title: Auth API
slug: /apps/backend/api/auth
---

API routes for the auth feature.

**Endpoints**

### GET /me

- Auth: `requireAnyAuth`
- Controller: `inline handler`

### POST /logout

- Auth: `public`
- Controller: `inline handler`

### GET /mfa/status

- Auth: `requireAuth`
- Controller: `MfaController`

### POST /mfa/totp/enable

- Auth: `requireAuth`
- Controller: `MfaController`

### POST /mfa/totp/disable

- Auth: `requireAuth`
- Controller: `MfaController`

### POST /mfa/totp/debug/create-device

- Auth: `requireAuth`
- Controller: `MfaDebugController`
