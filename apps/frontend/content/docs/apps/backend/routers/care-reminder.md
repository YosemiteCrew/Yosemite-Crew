---
id: backend-api-care-reminder
title: Care Reminder API
slug: /apps/backend/api/care-reminder
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/care-reminders

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CareReminderController`

### POST /pms/organisation/:organisationId/care-reminders

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CareReminderController`

### POST /pms/organisation/:organisationId/care-reminders/bulk

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CareReminderController`

### GET /pms/organisation/:organisationId/care-reminders/:reminderId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CareReminderController`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/send

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CareReminderController`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/respond

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CareReminderController`

### POST /pms/organisation/:organisationId/care-reminders/:reminderId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CareReminderController`
