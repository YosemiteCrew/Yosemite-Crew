---
id: backend-api-appointment-reminder-log
title: Appointment Reminder Log API
slug: /apps/backend/api/appointment-reminder-log
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/reminder-logs

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `AppointmentReminderLogController`

### PATCH /pms/organisation/:organisationId/reminder-logs/:logId/outcome

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `AppointmentReminderLogController`

### GET /pms/organisation/:organisationId/reminder-logs/stats

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `AppointmentReminderLogController`

### GET /pms/organisation/:organisationId/reminder-logs/by-appointment/:appointmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `AppointmentReminderLogController`

### GET /pms/organisation/:organisationId/reminder-logs/by-client/:clientId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `AppointmentReminderLogController`
