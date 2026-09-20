---
id: backend-api-room-unit-group
title: Room Unit Group API
slug: /apps/backend/api/room-unit-group
---

Manages room unit groups — named groupings of individually trackable units (for example a bank of kennels or cages) within one of an organisation's rooms, with a size, unit count, species constraints, and capability tags. Records are represented over the API as the FHIR `Location` resource. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `Location` resource (`resourceType: "Location"`)
- Controller: `RoomUnitGroupController.create`
- Response: `400`: keys `message` (payload is not a `Location` resource, or the organisation id could not be resolved), `201`: FHIR `Location` resource

### PUT /:id

- Auth: `requireWebAuth`
- RBAC: `withRoomUnitGroupOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `Location` resource
- Controller: `RoomUnitGroupController.update`
- Response: `400`: keys `message`, `403`: keys `message` (payload's organisation does not match the authorized organisation), `200`: FHIR `Location` resource

### GET /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `roomId`, `isActive`
- Controller: `RoomUnitGroupController.list`
- Response: `400`: keys `message`, `200`: array of FHIR `Location` resources

### DELETE /:id

- Auth: `requireWebAuth`
- RBAC: `withRoomUnitGroupOrgPermissions, requirePermission`
- Params: `id`
- Controller: `RoomUnitGroupController.delete`
- Response: `400`: keys `message`, `200`: FHIR `Location` resource (the deleted group)
