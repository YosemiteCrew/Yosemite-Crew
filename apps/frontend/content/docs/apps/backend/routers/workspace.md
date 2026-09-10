---
id: backend-api-workspace
title: Workspace API
slug: /apps/backend/api/workspace
---

Mobile routes are called by the mobile app on behalf of a pet parent.

**Endpoints**

### GET /mobile/encounters/:encounterId/document-packet/pdf

- Auth: `requireMobileAuth`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/appointments/:appointmentId

- Auth: `requireWebAuth`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/appointments/:appointmentId/documents

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/encounters/:encounterId

- Auth: `requireWebAuth`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/encounters/:encounterId/documents

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/encounters/:encounterId/finalization-gate

- Auth: `requireWebAuth`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/encounters/:encounterId/treatment-items

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `WorkspaceController`

### POST /organisations/:organisationId/encounters/:encounterId/treatment-items

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `WorkspaceController`

### PATCH /organisations/:organisationId/treatment-items/:itemId

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `WorkspaceController`

### DELETE /organisations/:organisationId/treatment-items/:itemId

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/companions/:companionId/documents

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/companions/:companionId/medical-records

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `WorkspaceController`

### POST /organisations/:organisationId/encounters/:encounterId/document-packet

- Auth: `requireWebAuth`
- Permission: `document:edit:any`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/encounters/:encounterId/document-packet/pdf

- Auth: `requireWebAuth`
- Controller: `WorkspaceController`

### GET /organisations/:organisationId/document-packets/:packetId

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `WorkspaceController`

### POST /organisations/:organisationId/document-packets/:packetId/sign

- Auth: `requireWebAuth`
- Permission: `document:edit:any`
- Controller: `WorkspaceController`

### POST /organisations/:organisationId/document-packets/:packetId/reconcile

- Auth: `requireWebAuth`
- Permission: `document:edit:any`
- Controller: `WorkspaceController`
