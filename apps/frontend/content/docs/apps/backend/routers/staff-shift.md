---
id: backend-api-staff-shift
title: Staff Shift API
slug: /apps/backend/api/staff-shift
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/staff-shifts

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `StaffShiftController`

### POST /pms/organisation/:organisationId/staff-shifts

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`

### GET /pms/organisation/:organisationId/staff-shifts/:shiftId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `StaffShiftController`

### PATCH /pms/organisation/:organisationId/staff-shifts/:shiftId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/start

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/complete

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`

### POST /pms/organisation/:organisationId/staff-shifts/:shiftId/no-show

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `StaffShiftController`
