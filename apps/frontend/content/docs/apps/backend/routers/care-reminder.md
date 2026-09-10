---
id: backend-api-care-reminder
title: Care Reminder API
slug: /apps/backend/api/care-reminder
---

Manages care reminders sent to clients on behalf of a patient — vaccination boosters, annual checkups, parasite treatment, dental cleaning, follow-ups, and custom reminders. Covers single and bulk creation, listing, sending, marking a reminder as responded to (optionally linking the appointment that resulted), and cancelling. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### GET /pms/organisation/:organisationId/care-reminders

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `status`, `reminderType`, `dueBefore`, `dueAfter`
- Controller: `CareReminderController.list`

### POST /pms/organisation/:organisationId/care-reminders

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `reminderType`, `customMessage`, `dueDate`, `sendAt`, `notes`
- Controller: `CareReminderController.create`
- Response: `201`: the created reminder record

### POST /pms/organisation/:organisationId/care-reminders/bulk

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `BulkCreateBodySchema`
- Body fields: `patientIds` (1-200), `reminderType`, `customMessage`, `dueDate`, `sendAt`
- Controller: `CareReminderController.bulkCreate`
- Response: `201`: the created reminder records

### GET /pms/organisation/:organisationId/care-reminders/:reminderId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `reminderId`
- Controller: `CareReminderController.get`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/send

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `reminderId`
- Controller: `CareReminderController.send`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/respond

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `reminderId`
- Body: `MarkRespondedBodySchema`
- Body fields: `appointmentId` (optional)
- Controller: `CareReminderController.markResponded`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `reminderId`
- Controller: `CareReminderController.cancel`
