---
id: backend-api-telemedicine-session
title: Telemedicine Session API
slug: /apps/backend/api/telemedicine-session
---

Manages telemedicine (remote consultation) sessions for a client and patient: scheduling a session, listing and retrieving them, and moving a session through its lifecycle (start, complete, cancel, mark no-show). Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/telemedicine

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `clientId`, `patientId`, `status` (`SCHEDULED`|`IN_PROGRESS`|`COMPLETED`|`NO_SHOW`|`CANCELLED`), `platform` (`VIDEO_CALL`|`PHONE_CALL`|`CHAT`|`EMAIL`)
- Controller: `TelemedicineSessionController.list`
- Response: `400`: keys `error`

### POST /pms/organisation/:organisationId/telemedicine

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `ScheduleSchema`
- Body fields: `clientId`, `patientId`, `appointmentId`, `platform`, `conductedBy`, `chiefComplaint`, `externalSessionId`
- Controller: `TelemedicineSessionController.schedule`
- Response: `400`: keys `error`, `201`: JSON (the scheduled session)

### GET /pms/organisation/:organisationId/telemedicine/:sessionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `sessionId`
- Controller: `TelemedicineSessionController.get`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/start

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `sessionId`
- Controller: `TelemedicineSessionController.start`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `sessionId`
- Body: `CompleteSchema`
- Body fields: `clinicianNotes`, `followUpRequired`, `recordingUrl`
- Controller: `TelemedicineSessionController.complete`
- Response: `400`: keys `error`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `sessionId`
- Controller: `TelemedicineSessionController.cancel`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/no-show

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `sessionId`
- Controller: `TelemedicineSessionController.markNoShow`
