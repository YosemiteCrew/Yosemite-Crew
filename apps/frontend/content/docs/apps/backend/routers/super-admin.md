---
id: backend-api-super-admin
title: Super Admin API
slug: /apps/backend/api/super-admin
---

Internal operations surface for the Yosemite Crew team, not part of the public developer API. It lists and moderates registered businesses (organisations) and their membership, and resolves lab-result records that were quarantined because they could not be matched to a patient automatically. Every route requires a super-admin session role (`requireSuperAdmin`), not organisation membership or organisation RBAC.

**Endpoints**

### GET /businesses

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Controller: `SuperAdminBusinessController.listBusinesses`
- Response: `200`: keys `businesses`, `500`: keys `error`, `code`

### GET /businesses/:id

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Params: `id`
- Controller: `SuperAdminBusinessController.getBusiness`
- Response: `400`: keys `error`, `code` (malformed business id), `404`: keys `error`, `code`, `200`: keys `business`

### PATCH /businesses/:id

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Params: `id`
- Body: `updateBusinessSchema`
- Body fields: `isVerified`, `isActive` (exactly one of the two is required)
- Controller: `SuperAdminBusinessController.updateBusiness`
- Response: `400`: keys `error`, `code`, `404`: keys `error`, `code`, `200`: keys `business`

### GET /businesses/:id/members

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Params: `id`
- Controller: `SuperAdminBusinessController.listMembers`
- Response: `400`: keys `error`, `code`, `404`: keys `error`, `code`, `200`: keys `members`

### GET /lab-ingestion/quarantine

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Query: `provider` (only `IDEXX` is accepted)
- Controller: `SuperAdminLabIngestionController.listQuarantine`
- Response: `400`: keys `error`, `code`, `200`: JSON (unresolved quarantined lab results, optionally filtered by provider)

### PATCH /lab-ingestion/quarantine/:id/resolve

- Auth: `requireAnyAuth`, `requireSuperAdmin`
- Params: `id`
- Controller: `SuperAdminLabIngestionController.resolveQuarantine`
- Response: `400`: keys `error`, `code` (id is not a UUID), `404`: keys `error`, `code` (no unresolved quarantined result with that id), `200`: keys `id`, `resolved`
