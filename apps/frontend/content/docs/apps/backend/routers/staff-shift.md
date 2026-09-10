---
id: backend-api-staff-shift
title: Staff Shift API
slug: /apps/backend/api/staff-shift
---

Manages clinic staff shifts: scheduling a shift, listing and retrieving them, and moving a shift through its lifecycle (start, complete, cancel, mark no-show). Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/staff-shifts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `staffId`, `role`, `status` (`SCHEDULED`|`IN_PROGRESS`|`COMPLETED`|`CANCELLED`|`NO_SHOW`), `date`
- Controller: `StaffShiftController.list`

### POST /pms/organisation/:organisationId/staff-shifts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateSchema`
- Body fields: `staffId`, `role`, `shiftDate`, `startTime`, `endTime`, `breakMinutes`, `notes`, `createdBy`
- Controller: `StaffShiftController.create`
- Response: `400`: keys `errors`, `201`: JSON (the created shift)

### GET /pms/organisation/:organisationId/staff-shifts/:shiftId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Controller: `StaffShiftController.get`

### PATCH /pms/organisation/:organisationId/staff-shifts/:shiftId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Body: `UpdateSchema`
- Body fields: `role`, `shiftDate`, `startTime`, `endTime`, `breakMinutes`, `notes`, `updatedBy` (all optional)
- Controller: `StaffShiftController.update`
- Response: `400`: keys `errors`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/start

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Controller: `StaffShiftController.start`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Controller: `StaffShiftController.complete`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Body fields: `cancelledBy`
- Controller: `StaffShiftController.cancel`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/no-show

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `shiftId`
- Controller: `StaffShiftController.markNoShow`
