---
id: backend-api-client-complaint
title: Client Complaint API
slug: /apps/backend/api/client-complaint
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/client-complaints

- Auth: `requireWebAuth`
- Permission: `teams:edit:any`
- Controller: `clientComplaintController`

### GET /pms/organisation/:organisationId/client-complaints

- Auth: `requireWebAuth`
- Permission: `teams:view:any`
- Controller: `clientComplaintController`

### GET /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- Permission: `teams:view:any`
- Controller: `clientComplaintController`

### PATCH /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- Permission: `teams:edit:any`
- Controller: `clientComplaintController`

### DELETE /pms/organisation/:organisationId/client-complaints/:complaintId

- Auth: `requireWebAuth`
- Permission: `teams:edit:any`
- Controller: `clientComplaintController`

### POST /pms/organisation/:organisationId/client-complaints/:complaintId/notes

- Auth: `requireWebAuth`
- Permission: `teams:edit:any`
- Controller: `clientComplaintController`
