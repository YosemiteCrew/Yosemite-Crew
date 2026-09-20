---
id: backend-api-room-unit
title: Room Unit API
slug: /apps/backend/api/room-unit
---

CRUD endpoints for an individual room unit (for example a specific kennel or bed within a room/room group), modeled as the FHIR `Location` resource. None of these routes carry `:organisationId` in the path, so it is resolved by `withOrgPermissions`/`withRoomUnitOrgPermissions` from the `x-org-id` header, an `organisationId` query parameter, or (on create) the request body — update and delete instead resolve it by looking up the unit's own stored organisation. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `Location` resource (only `resourceType: "Location"` is validated; the rest is mapped via `fromRoomUnitRequestDTO`)
- Controller: `RoomUnitController.create`
- Response: `201`: FHIR `Location` resource (via `toRoomUnitResponseDTO`), `400`: keys `message`

### PUT /:id

- Auth: `requireWebAuth`
- RBAC: `withRoomUnitOrgPermissions, requirePermission` (resolves the organisation from the room unit's own record, not from the caller)
- Params: `id`
- Body: FHIR `Location` resource (only `resourceType: "Location"` is validated; the rest is mapped via `fromRoomUnitRequestDTO`)
- Controller: `RoomUnitController.update`
- Response: `200`: FHIR `Location` resource (via `toRoomUnitResponseDTO`), `400`: keys `message`, `403`: keys `message` — when the body's `organisationId` does not match the authorized organisation

### GET /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `roomId`, `unitGroupId`, `isActive`, `organisationId`
- Controller: `RoomUnitController.list`
- Response: `200`: array of FHIR `Location` resources, `400`: keys `message`

### DELETE /:id

- Auth: `requireWebAuth`
- RBAC: `withRoomUnitOrgPermissions, requirePermission` (resolves the organisation from the room unit's own record, not from the caller)
- Params: `id`
- Controller: `RoomUnitController.delete`
- Response: `200`: FHIR `Location` resource, the deleted unit (via `toRoomUnitResponseDTO`), `400`: keys `message`
