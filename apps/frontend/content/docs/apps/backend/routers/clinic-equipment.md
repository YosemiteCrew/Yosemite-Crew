---
id: backend-api-clinic-equipment
title: Clinic Equipment API
slug: /apps/backend/api/clinic-equipment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/clinic-equipment

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `ClinicEquipmentController`

### GET /pms/organisation/:organisationId/clinic-equipment

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `ClinicEquipmentController`

### GET /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `ClinicEquipmentController`

### PATCH /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `ClinicEquipmentController`

### DELETE /pms/organisation/:organisationId/clinic-equipment/:equipmentId

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `ClinicEquipmentController`

### POST /pms/organisation/:organisationId/clinic-equipment/:equipmentId/maintenance-logs

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `ClinicEquipmentController`

### GET /pms/organisation/:organisationId/clinic-equipment/:equipmentId/maintenance-logs

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `ClinicEquipmentController`
