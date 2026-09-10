---
id: backend-api-blood-transfusion
title: Blood Transfusion API
slug: /apps/backend/api/blood-transfusion
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/blood-transfusions

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodTransfusionController`

### POST /pms/organisation/:organisationId/blood-transfusions

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodTransfusionController`

### GET /pms/organisation/:organisationId/blood-transfusions/:transfusionId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodTransfusionController`

### PUT /pms/organisation/:organisationId/blood-transfusions/:transfusionId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodTransfusionController`

### POST /pms/organisation/:organisationId/blood-transfusions/:transfusionId/reaction

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodTransfusionController`
