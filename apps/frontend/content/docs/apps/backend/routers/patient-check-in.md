---
id: backend-api-patient-check-in
title: Patient Check-In API
slug: /apps/backend/api/patient-check-in
---

Manages a patient's front-desk check-in at a PMS organisation: recording arrival and triage priority, assigning a room, and marking the check-in seen, completed, cancelled, or a no-show. All routes require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/check-in

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `status?`, `date?`
- Controller: `PatientCheckInController.list`

### POST /pms/organisation/:organisationId/check-in

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `clientId`, `appointmentId?`, `arrivedAt`, `triagePriority?`, `triageNote?`, `checkedInBy?`, `notes?`
- Controller: `PatientCheckInController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/check-in/:checkInId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Controller: `PatientCheckInController.get`

### POST /pms/organisation/:organisationId/check-in/:checkInId/seen

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Controller: `PatientCheckInController.markSeen`

### POST /pms/organisation/:organisationId/check-in/:checkInId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Controller: `PatientCheckInController.complete`

### POST /pms/organisation/:organisationId/check-in/:checkInId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Controller: `PatientCheckInController.cancel`

### POST /pms/organisation/:organisationId/check-in/:checkInId/no-show

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Controller: `PatientCheckInController.markNoShow`

### POST /pms/organisation/:organisationId/check-in/:checkInId/room

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checkInId`
- Body fields: `roomId`
- Controller: `PatientCheckInController.assignRoom`
