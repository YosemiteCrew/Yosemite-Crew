---
id: backend-api-companion-organisation
title: Companion Organisation API
slug: /apps/backend/api/companion-organisation
---

**Endpoints**

### POST /link
- Auth: `authorizeCognitoMobile`
- Controller: `CompanionOrganisationController.linkByParent`
- Response: `401`: keys `message`, `400`: keys `message`, `201`: keys `message`, `500`: keys `message`

### POST /invite
- Auth: `authorizeCognitoMobile`
- Controller: `CompanionOrganisationController.sendInvite`
- Response: `401`: keys `message`, `400`: keys `message`, `201`: keys `message`, `500`: keys `message`

### POST /:linkId/approve
- Auth: `authorizeCognitoMobile`
- Params: `linkId`
- Controller: `CompanionOrganisationController.approvePendingLink`
- Response: `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /:linkId/deny
- Auth: `authorizeCognitoMobile`
- Params: `linkId`
- Controller: `CompanionOrganisationController.denyPendingLink`
- Response: `401`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /revoke/:linkId
- Auth: `authorizeCognitoMobile`
- Params: `linkId`
- Controller: `CompanionOrganisationController.revokeLink`
- Response: `200`: keys `message`, `500`: keys `message`

### GET /:companionId
- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Query: `type`
- Controller: `CompanionOrganisationController.getLinksForCompanionByOrganisationType`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/accept
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `CompanionOrganisationController.acceptInvite`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/reject
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `CompanionOrganisationController.rejectInvite`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /pms/:organisationId/:companionId/link
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `CompanionOrganisationController.linkByPmsUser`
- Response: `401`: keys `message`, `400`: keys `message`, `404`: keys `message`, `201`: keys `message`, `500`: keys `message`

### GET /pms/:organisationId/list
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `CompanionOrganisationController.getLinksForOrganisation`
- Response: `200`: JSON, `500`: keys `message`
