---
id: backend-api-client-complaint
title: Client Complaint API
slug: /apps/backend/api/client-complaint
---

Tracks client complaints against a practice — category (clinical care, communication, billing, wait times, facilities, staff conduct, outcome concern, other), status workflow (open, investigating, pending response, resolved, closed, escalated), assignment, resolution, and an internal/external note thread. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### POST /pms/organisation/:organisationId/client-complaints

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateComplaintSchema`
- Body fields: `clientId`, `patientId`, `encounterId`, `category`, `summary`, `description`, `reportedAt`, `reportedBy`, `assignedTo`
- Controller: `clientComplaintController.create`
- Response: `201`: the created complaint, `400`: `{ error }` on invalid body

### GET /pms/organisation/:organisationId/client-complaints

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `clientId`, `status`, `category`
- Controller: `clientComplaintController.list`

### GET /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `complaintId`
- Controller: `clientComplaintController.get`

### PATCH /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `complaintId`
- Body: `UpdateComplaintSchema`
- Body fields: `status`, `category`, `summary`, `description`, `assignedTo`, `resolvedAt`, `resolutionNotes`
- Controller: `clientComplaintController.update`
- Response: `400`: `{ error }` on invalid body

### POST /pms/organisation/:organisationId/client-complaints/:complaintId/notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `complaintId`
- Body: `AddNoteSchema`
- Body fields: `content`, `authorId`, `isInternal`
- Controller: `clientComplaintController.addNote`
- Response: `201`: the created note, `400`: `{ error }` on invalid body

### DELETE /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `complaintId`
- Controller: `clientComplaintController.delete`
- Response: `204`: no content
