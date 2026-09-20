---
id: backend-api-clinic-equipment
title: Clinic Equipment API
slug: /apps/backend/api/clinic-equipment
---

Tracks clinic equipment inventory (name, model, serial number, manufacturer, purchase date, warranty expiry, operational status, location) and its maintenance history (routine service, calibration, repair, inspection, cleaning, replacement, software update). All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### POST /pms/organisation/:organisationId/clinic-equipment

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateEquipmentSchema`
- Body fields: `name`, `model`, `serialNumber`, `manufacturer`, `purchasedAt`, `warrantyExpiry`, `status`, `locationNotes`, `notes`
- Controller: `ClinicEquipmentController.create`
- Response: `201`: the created equipment record, `400`: `{ error }` on invalid body

### GET /pms/organisation/:organisationId/clinic-equipment

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `status`, `search`
- Controller: `ClinicEquipmentController.list`
- Response: `400`: `{ error }` on invalid query

### GET /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `equipmentId`
- Controller: `ClinicEquipmentController.get`

### PATCH /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `equipmentId`
- Body: `CreateEquipmentSchema` (all fields optional)
- Body fields: `name`, `model`, `serialNumber`, `manufacturer`, `purchasedAt`, `warrantyExpiry`, `status`, `locationNotes`, `notes`
- Controller: `ClinicEquipmentController.update`
- Response: `400`: `{ error }` on invalid body

### DELETE /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `equipmentId`
- Controller: `ClinicEquipmentController.delete`
- Response: `204`: no content

### POST /pms/organisation/:organisationId/clinic-equipment/:equipmentId/maintenance-logs

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `equipmentId`
- Body: `AddMaintenanceLogSchema`
- Body fields: `maintenanceType`, `performedBy`, `vendor`, `scheduledAt`, `performedAt`, `nextDueAt`, `cost`, `currency`, `passed`, `notes`
- Controller: `ClinicEquipmentController.addMaintenanceLog`
- Response: `201`: the created maintenance log, `400`: `{ error }` on invalid body

### GET /pms/organisation/:organisationId/clinic-equipment/:equipmentId/maintenance-logs

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `equipmentId`
- Controller: `ClinicEquipmentController.listMaintenanceLogs`
