---
id: backend-api-companion-card
title: Companion Card API
slug: /apps/backend/api/companion-card
---

Issues, lists, and revokes shareable "companion card" links for a patient in the PIMS (Practice Information Management System, the clinic-facing web app). A card is a redacted profile — identity, medical alerts, owner contact — built from a per-audience field policy; a token may only be issued for the `PUBLIC` (collar-tag QR, no hard expiry by default) or `REFERRAL_CLINIC` (time-limited handoff) audience, since STAFF and OWNER authenticate directly and never need one. The token minted here is resolved by the separate, unauthenticated `companion-card-public` router.

**Endpoints**

### POST /pms/organisation/:organisationId/companion/:patientId/share

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Body fields: `audience`, `ttlSeconds`, `showOwnerPhone`
- Controller: `CompanionCardController.issueShareToken`
- Response: `201`: keys `token`, `qrPayload`, `share` — `token` is the raw share token, returned only this once; `share` is the token's metadata record

### GET /pms/organisation/:organisationId/companion/:patientId/shares

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Controller: `CompanionCardController.listTokens`
- Response: `200`: keys `tokens`

### DELETE /pms/organisation/:organisationId/share/:tokenId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `tokenId`
- Controller: `CompanionCardController.revokeToken`
- Response: `200`: keys `id`, `audience`, `showOwnerPhone`, `expiresAt`, `revokedAt`, `lastViewedAt`, `viewCount`, `createdAt`
