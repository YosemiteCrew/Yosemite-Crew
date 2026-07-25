---
id: backend-api-companion-organisation
title: Companion Organisation API
slug: /apps/backend/api/companion-organisation
---

Manages the link between a companion (a pet) and an organisation (a clinic): linking, invites, approval, and revocation. Routes without a prefix are called by the mobile app (pet parents); routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /link

- Auth: `requireMobileAuth`
- Controller: `CompanionOrganisationController.linkByParent`
- Response: `401`: keys `message`, `400`: keys `message`, `201`: keys `message`, `500`: keys `message`

### POST /invite

- Auth: `requireMobileAuth`
- Controller: `CompanionOrganisationController.sendInvite`
- Response: `401`: keys `message`, `400`: keys `message`, `201`: keys `message`, `500`: keys `message`

### POST /:linkId/approve

- Auth: `requireMobileAuth`
- Params: `linkId`
- Controller: `CompanionOrganisationController.approvePendingLink`
- Response: `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /:linkId/deny

- Auth: `requireMobileAuth`
- Params: `linkId`
- Controller: `CompanionOrganisationController.denyPendingLink`
- Response: `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /revoke/:linkId

- Auth: `requireMobileAuth`
- Params: `linkId`
- Controller: `CompanionOrganisationController.revokeLink`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /:companionId

- Auth: `requireMobileAuth`
- Params: `companionId`
- Query: `type`
- Controller: `CompanionOrganisationController.getLinksForCompanionByOrganisationType`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/accept

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `CompanionOrganisationController.acceptInvite`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/reject

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `CompanionOrganisationController.rejectInvite`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/:organisationId/:companionId/link

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `CompanionOrganisationController.linkByPmsUser`
- Response: `401`: keys `message`, `400`: keys `message`, `404`: keys `message`, `201`: keys `message`, `500`: keys `message`

### GET /pms/:organisationId/list

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `CompanionOrganisationController.getLinksForOrganisation`
- Response: `200`: JSON, `500`: keys `message`
