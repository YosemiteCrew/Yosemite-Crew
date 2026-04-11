---
id: backend-api-organization
title: Organization API
slug: /apps/backend/api/organization
---

**Endpoints**

### POST /check
- Query: `lat`, `limit`, `lng`, `page`, `radius`
- Controller: `OrganizationController.getNearbyPaginated`
- Response: `400`: keys `message`, `500`: JSON

### GET /mobile/getNearby
- Auth: `authorizeCognitoMobile`
- Query: `lat`, `limit`, `lng`, `page`, `radius`
- Controller: `OrganizationController.getNearbyPaginated`
- Response: `400`: keys `message`, `500`: JSON

### POST /logo/presigned-url
- Controller: `OrganizationController.getLogoUploadUrl`
- Response: `400`: keys `message`, `200`: keys `s3Key`, `uploadUrl`, `500`: keys `message`

### POST /
- Auth: `authorizeCognito`
- Controller: `OrganizationController.getAllBusinesses`
- Response: `200`: JSON, `500`: keys `message`

### GET /:organizationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organizationId`
- Controller: `OrganizationController.getBusinessById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:organizationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organizationId`
- Controller: `OrganizationController.updateBusinessById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /:organizationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organizationId`
- Controller: `OrganizationController.deleteBusinessById`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /:organizationId/specality
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organizationId`
- Controller: `SpecialityController.getAllByOrganizationId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### POST /:organisationId/invites
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `OrganisationInviteController.createInvite`
- Response: `400`: keys `message`, `401`: keys `departmentIds`, `employmentType`, `inviteeEmail`, `inviteeName`, `message`, `role`, `201`: keys `message`, `500`: keys `message`

### GET /:organisationId/invites
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `OrganisationInviteController.listOrganisationInvites`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
