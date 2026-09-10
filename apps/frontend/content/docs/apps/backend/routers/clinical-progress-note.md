---
id: backend-api-clinical-progress-note
title: Clinical Progress Note API
slug: /apps/backend/api/clinical-progress-note
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/clinical-notes

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ClinicalProgressNoteController`

### POST /pms/organisation/:organisationId/clinical-notes

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ClinicalProgressNoteController`

### GET /pms/organisation/:organisationId/clinical-notes/:noteId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ClinicalProgressNoteController`

### PUT /pms/organisation/:organisationId/clinical-notes/:noteId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ClinicalProgressNoteController`

### POST /pms/organisation/:organisationId/clinical-notes/:noteId/sign

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ClinicalProgressNoteController`
