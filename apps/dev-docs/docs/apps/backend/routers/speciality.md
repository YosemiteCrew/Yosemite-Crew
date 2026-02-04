---
id: backend-api-speciality
title: Speciality API
slug: /apps/backend/api/speciality
---

**Endpoints**

### POST /
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `SpecialityController.create`
- Response: `400`: keys `message`, `500`: keys `message`

### GET /:organisationId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `SpecialityController.getAllByOrganizationId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:id
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `SpecialityController.update`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /:organisationId/:specialityId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Controller: `SpecialityController.deleteSpeciality`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
