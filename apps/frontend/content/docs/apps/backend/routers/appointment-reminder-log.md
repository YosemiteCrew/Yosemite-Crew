---
id: backend-api-appointment-reminder-log
title: Appointment Reminder Log API
slug: /apps/backend/api/appointment-reminder-log
---

Records and queries the delivery history of appointment reminders (SMS, email, push notification, phone call, or WhatsApp) sent to clients, and their outcomes, for the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. `record` and `updateOutcome` validate their body with Zod and return `400` with keys `error` (the Zod issue list) on failure; `stats` reads its query params directly off `req.query` without a schema.

**Endpoints**

### POST /pms/organisation/:organisationId/reminder-logs

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordSchema`
- Body fields: `appointmentId`, `clientId`, `channel`, `outcome`, `sentAt`, `respondedAt`, `messagePreview`, `externalId`, `errorMessage`
- Controller: `AppointmentReminderLogController.record`
- Response: `201`: JSON (recorded reminder log entry), `400`: keys `error`

### PATCH /pms/organisation/:organisationId/reminder-logs/:logId/outcome

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `logId`
- Body: `UpdateOutcomeSchema`
- Body fields: `outcome`, `respondedAt`
- Controller: `AppointmentReminderLogController.updateOutcome`

### GET /pms/organisation/:organisationId/reminder-logs/stats

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `appointmentId`, `channel`
- Controller: `AppointmentReminderLogController.stats`

### GET /pms/organisation/:organisationId/reminder-logs/by-appointment/:appointmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `AppointmentReminderLogController.listForAppointment`

### GET /pms/organisation/:organisationId/reminder-logs/by-client/:clientId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `clientId`
- Query: `channel`, `outcome`, `limit`
- Controller: `AppointmentReminderLogController.listForClient`
