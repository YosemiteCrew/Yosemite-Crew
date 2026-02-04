---
id: backend-api-organisation-room
title: Organisation Room API
slug: /apps/backend/api/organisation-room
---

**Endpoints**

### POST /
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `OrganisationRoomController.create`
- Response: `400`: keys `message`, `500`: keys `message`

### PUT /:id
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `OrganisationRoomController.update`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### GET /organization/:organizationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organizationId`
- Controller: `OrganisationRoomController.getAllByOrganizationId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /:id
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `OrganisationRoomController.delete`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`
