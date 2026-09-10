---
id: backend-api-surgical-checklist
title: Surgical Checklist API
slug: /apps/backend/api/surgical-checklist
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/surgical-checklists

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `surgicalChecklistController`

### GET /pms/organisation/:organisationId/surgical-checklists

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `surgicalChecklistController`

### GET /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `surgicalChecklistController`

### PATCH /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `surgicalChecklistController`

### DELETE /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `surgicalChecklistController`

### POST /pms/organisation/:organisationId/surgical-checklists/:checklistId/items/:itemId/check

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `surgicalChecklistController`

### POST /pms/organisation/:organisationId/surgical-checklists/:checklistId/items/:itemId/uncheck

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `surgicalChecklistController`
