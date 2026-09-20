---
id: backend-api-activitypub
title: Activitypub API
slug: /apps/backend/api/activitypub
---

Implements ActivityPub (the federation protocol used by Mastodon and similar platforms) so organisations can follow one another, exchange clinical referrals, and broadcast emergency notices across instances. The `/organizations/:orgId/*` and `/shared-inbox` routes are the public protocol surface consumed by remote ActivityPub servers and carry no auth. The `/manage/*` routes are the organisation's own settings surface, reached from the web settings panel, and require RBAC (role-based access control) under the `integrations` permission pair. Every route in this router 404s with `{ error: "Federation is disabled on this instance" }` unless the `AP_ENABLED` environment variable is `"true"`.

**Endpoints**

### GET /organizations/:orgId

- Params: `orgId`
- Controller: `ActivityPubController.getActor`
- Response: `200`: ActivityPub actor object (JSON), `404`: keys `error`

### POST /organizations/:orgId/inbox

- Params: `orgId`
- Body: raw ActivityPub activity (only checked for parseable JSON, not schema-validated)
- Controller: `ActivityPubController.postInbox`
- Response: `202`: empty body — the activity is queued for async processing, `400`: keys `error`, `500`: keys `error`

### GET /organizations/:orgId/outbox

- Params: `orgId`
- Controller: `ActivityPubController.getOutbox`
- Response: `200`: ActivityPub OrderedCollection (JSON)

### GET /organizations/:orgId/followers

- Params: `orgId`
- Controller: `ActivityPubController.getFollowers`
- Response: `200`: ActivityPub Collection (JSON)

### GET /organizations/:orgId/following

- Params: `orgId`
- Controller: `ActivityPubController.getFollowing`
- Response: `200`: ActivityPub Collection (JSON)

### POST /shared-inbox

- Body: raw ActivityPub activity (only checked for parseable JSON, not schema-validated)
- Controller: `ActivityPubController.postSharedInbox`
- Response: `202`: empty body — the activity is queued for async processing per addressed organisation, `400`: keys `error`, `500`: keys `error`

### GET /manage/actor

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.getActorSettings`
- Response: `200`: keys `uri`, `preferredUsername`, `publicKeyId`, `inboxUri`, `outboxUri`, `followersUri`, `followingUri`, `sharedInboxUri`, `summary`, `iconUrl`, `createdAt`, `licenseTokenStatus`, `isVerified`, `directoryListed`, `500`: keys `error`

### POST /manage/follow

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `remoteActorUri`
- Controller: `ActivityPubController.follow`
- Response: `202`: JSON (Follow activity), `400`: keys `error`, `500`: keys `error`

### POST /manage/unfollow

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `remoteActorUri`
- Controller: `ActivityPubController.unfollow`
- Response: `202`: JSON (Undo activity), `400`: keys `error`, `404`: keys `error` (not following that actor), `500`: keys `error`

### POST /manage/followers/approve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `remoteActorUri`
- Controller: `ActivityPubController.approveFollower`
- Response: `200`: keys `ok`, `400`: keys `error`, `500`: keys `error`

### POST /manage/followers/reject

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `remoteActorUri`
- Controller: `ActivityPubController.rejectFollower`
- Response: `200`: keys `ok`, `400`: keys `error`, `500`: keys `error`

### GET /manage/followers

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.listFollowers`

### GET /manage/following

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.listFollowing`

### POST /manage/referrals

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `SendReferralBodySchema`
- Body fields: `toActorUri`, `patientSummary`, `urgency`, `clinicalContext`
- Controller: `ActivityPubController.sendReferral`
- Response: `202`: JSON (Offer activity), `400`: keys `error`, `details`, `500`: keys `error`

### GET /manage/referrals/inbound

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.listInboundReferrals`

### GET /manage/referrals/outbound

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.listOutboundReferrals`

### PUT /manage/license-token

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `token`
- Controller: `ActivityPubController.updateLicenseToken`
- Response: `200`: keys `ok`, `400`: keys `error`, `422`: keys `error`

### PUT /manage/directory-listing

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `listed`
- Controller: `ActivityPubController.toggleDirectoryListing`
- Response: `200`: JSON (result of `setDirectoryListing`), `400`: keys `error`, `422`: keys `error`

### GET /manage/directory

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `ActivityPubController.getDirectory`

### PATCH /manage/referrals/:referralId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `referralId`
- Body fields: `action` (`"accept"` or `"decline"`)
- Controller: `ActivityPubController.respondToReferral`
- Response: `200`: JSON (result of `respondToReferral`), `400`: keys `error`, `422`: keys `error`

### PUT /manage/actor

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `summary`, `iconUrl`
- Controller: `ActivityPubController.updateActorProfile`
- Response: `200`: keys `summary`, `iconUrl`, `500`: keys `error`

### POST /manage/notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `toActorUri`, `content`, `inReplyTo`
- Controller: `ActivityPubController.sendNote`
- Response: `202`: JSON (Note activity), `400`: keys `error`, `500`: keys `error`

### POST /manage/announce

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body fields: `content`, `urgency`
- Controller: `ActivityPubController.announceEmergency`
- Response: `202`: JSON (Announce activity), `400`: keys `error`, `500`: keys `error`
