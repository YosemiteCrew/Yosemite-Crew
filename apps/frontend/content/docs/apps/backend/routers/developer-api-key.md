---
id: backend-api-developer-api-key
title: Developer API Key API
slug: /apps/backend/api/developer-api-key
---

Lets a signed-in developer manage their own API credentials from the developer portal (`/developers/api-keys` in the frontend) — mint a key, list the keys they hold, and revoke one. This is session-authenticated, not API-key authenticated: a developer signup grants only the `developer` role with no organisation membership, so there is nothing for an organisation permission gate to check, and every query is scoped to the caller's own verified id rather than to a role or practice. A key's plaintext secret (`yc_live_…` or `yc_test_…`, set by the `environment` field) is returned exactly once, at creation, and is never persisted or shown again; each owner may hold at most 25 active keys.

**Endpoints**

### POST /

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Body fields: `name`, `scopes`, `environment`, `expiresAt`
- Controller: `DeveloperApiKeyController.createApiKey`
- Response: `201`: keys `id`, `name`, `prefix`, `last4`, `scopes`, `environment`, `apiKey` — `apiKey` is the plaintext secret, present only in this response

### GET /

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Controller: `DeveloperApiKeyController.listApiKeys`
- Response: `200`: keys `data` — each entry has `id`, `name`, `prefix`, `last4`, `scopes`, `environment`, `status`, `lastUsedAt`, `expiresAt`, `revokedAt`, `createdAt` (no secret)

### DELETE /:keyId

- Auth: `requireWebAuth`, `requireActiveAccount()`
- Params: `keyId`
- Controller: `DeveloperApiKeyController.revokeApiKey`
- Response: `204`: no content; `404`: keys `message` — no active key with that id for this owner
