---
id: backend-api-surgical-checklist
title: Surgical Checklist API
slug: /apps/backend/api/surgical-checklist
---

Manages surgical safety checklists for a patient encounter (the Sign-In / Time-Out / Sign-Out phases used around a procedure): creating a checklist with its items, checking and unchecking individual items, and updating or deleting the checklist. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/surgical-checklists

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateChecklistSchema`
- Body fields: `patientId`, `encounterId`, `phase` (`SIGN_IN`|`TIME_OUT`|`SIGN_OUT`), `conductedBy`, `notes`, `items` (array of `{ label, sortOrder, notes }`)
- Controller: `surgicalChecklistController.create`
- Response: `400`: keys `error`, `201`: JSON (the created checklist)

### GET /pms/organisation/:organisationId/surgical-checklists

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `status` (`PENDING`|`IN_PROGRESS`|`COMPLETED`|`ABANDONED`)
- Controller: `surgicalChecklistController.list`

### GET /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checklistId`
- Controller: `surgicalChecklistController.get`

### PATCH /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checklistId`
- Body: `UpdateChecklistSchema`
- Body fields: `phase`, `status`, `conductedBy`, `notes`, `completedAt` (all optional)
- Controller: `surgicalChecklistController.update`
- Response: `400`: keys `error`

### POST /pms/organisation/:organisationId/surgical-checklists/:checklistId/items/:itemId/check

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checklistId`, `itemId`
- Body: `CheckItemSchema`
- Body fields: `checkedBy`, `notes`
- Controller: `surgicalChecklistController.checkItem`
- Response: `400`: keys `error`

### POST /pms/organisation/:organisationId/surgical-checklists/:checklistId/items/:itemId/uncheck

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checklistId`, `itemId`
- Controller: `surgicalChecklistController.uncheckItem`

### DELETE /pms/organisation/:organisationId/surgical-checklists/:checklistId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `checklistId`
- Controller: `surgicalChecklistController.delete`
- Response: `204`: no content
