---
id: backend-api-clinic-note
title: Clinic Note API
slug: /apps/backend/api/clinic-note
---

Free-text notes attached to a patient, client, or appointment (the note's "subject"), typed as general, billing, communication, follow-up, or alert, with the ability to pin/unpin a note for visibility. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### POST /pms/organisation/:organisationId/clinic-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateNoteSchema`
- Body fields: `subjectType` (`PATIENT`, `CLIENT`, or `APPOINTMENT`), `subjectId`, `noteType`, `content`, `isPinned`, `createdBy`
- Controller: `ClinicNoteController.create`
- Response: `201`: the created note, `400`: `{ error }` on invalid body

### GET /pms/organisation/:organisationId/clinic-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `subjectType`, `subjectId`, `noteType`, `isPinned`
- Controller: `ClinicNoteController.list`

### GET /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Controller: `ClinicNoteController.get`

### PATCH /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Body: `UpdateNoteSchema`
- Body fields: `content`, `noteType`
- Controller: `ClinicNoteController.update`
- Response: `400`: `{ error }` on invalid body

### DELETE /pms/organisation/:organisationId/clinic-notes/:noteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Controller: `ClinicNoteController.delete`
- Response: `204`: no content

### POST /pms/organisation/:organisationId/clinic-notes/:noteId/pin

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Body fields: `pinnedBy` (optional, read directly from the body — not schema-validated)
- Controller: `ClinicNoteController.pin`

### POST /pms/organisation/:organisationId/clinic-notes/:noteId/unpin

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Controller: `ClinicNoteController.unpin`
