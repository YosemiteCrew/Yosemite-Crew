---
id: backend-api-speciality
title: Speciality API
slug: /apps/backend/api/speciality
---

CRUD endpoints for an organisation's specialities (the areas of veterinary practice it offers). Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `SpecialityController.create`
- Response: `400`: keys `message`, `500`: keys `message`

### GET /:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `SpecialityController.getAllByOrganizationId`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`

### PUT /:id

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `id`
- Controller: `SpecialityController.update`
- Response: `400`: keys `message`, `404`: keys `message`, `200`: keys `message`, `500`: keys `message`

### DELETE /:organisationId/:specialityId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `specialityId`
- Controller: `SpecialityController.deleteSpeciality`
- Response: `400`: keys `message`, `200`: keys `message`, `500`: keys `message`
