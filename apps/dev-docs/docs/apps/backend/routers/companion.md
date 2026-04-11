---
id: backend-api-companion
title: Companion API
slug: /apps/backend/api/companion
---

**Endpoints**

### POST /
- Auth: `authorizeCognitoMobile`
- Controller: `CompanionController.createCompanionMobile`
- Response: `401`: keys `message`, `201`: keys `message`, `500`: keys `message`

### GET /:id
- Auth: `authorizeCognitoMobile`
- Params: `id`
- Controller: `CompanionController.getCompanionById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:id
- Auth: `authorizeCognitoMobile`
- Params: `id`
- Controller: `CompanionController.deleteCompanion`
- Response: `400`: keys `message`, `204`: keys `message`, `500`: keys `message`

### POST /profile/presigned
- Auth: `authorizeCognitoMobile`
- Controller: `CompanionController.getProfileUploadUrl`
- Response: `400`: keys `message`, `200`: JSON, `500`: keys `message`

### GET /org/search
- Auth: `authorizeCognito`
- RBAC: `requirePermission`
- Query: `name`
- Controller: `CompanionController.searchCompanionByName`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /org/:orgId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `CompanionController.createCompanionPMS`
- Response: `400`: keys `message`, `401`: keys `message`, `404`: keys `message`, `201`: keys `message`, `500`: keys `message`

### GET /org/:id
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `CompanionController.getCompanionById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /org/:id
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `CompanionController.updateCompanion`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /pms/:parentId/:organisationId/list
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `parentId`, `organisationId`
- Controller: `CompanionController.listParentCompanionsNotInOrganisation`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
