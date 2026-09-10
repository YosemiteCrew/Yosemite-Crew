---
id: backend-api-preventive-care-plan
title: Preventive Care Plan API
slug: /apps/backend/api/preventive-care-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/preventive-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PreventiveCarePlanController`

### POST /pms/organisation/:organisationId/preventive-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PreventiveCarePlanController`

### GET /pms/organisation/:organisationId/preventive-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PreventiveCarePlanController`

### PUT /pms/organisation/:organisationId/preventive-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PreventiveCarePlanController`

### POST /pms/organisation/:organisationId/preventive-care-plans/:planId/items

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PreventiveCarePlanController`

### POST /pms/organisation/:organisationId/preventive-care-plans/:planId/items/:itemId/complete

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PreventiveCarePlanController`
