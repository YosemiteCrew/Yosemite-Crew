---
id: backend-api-clinic-note
title: Clinic Note API
slug: /apps/backend/api/clinic-note
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/clinic-notes/:noteId/pin

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicNoteController`

### POST /pms/organisation/:organisationId/clinic-notes/:noteId/unpin

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicNoteController`

### POST /pms/organisation/:organisationId/clinic-notes

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicNoteController`

### GET /pms/organisation/:organisationId/clinic-notes

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `ClinicNoteController`

### GET /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `ClinicNoteController`

### PATCH /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicNoteController`

### DELETE /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicNoteController`
