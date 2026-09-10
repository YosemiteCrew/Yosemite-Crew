---
id: backend-api-patient-check-in
title: Patient Check In API
slug: /apps/backend/api/patient-check-in
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/check-in

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`

### GET /pms/organisation/:organisationId/check-in/:checkInId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in/:checkInId/seen

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in/:checkInId/complete

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in/:checkInId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in/:checkInId/no-show

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`

### POST /pms/organisation/:organisationId/check-in/:checkInId/room

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientCheckInController`
