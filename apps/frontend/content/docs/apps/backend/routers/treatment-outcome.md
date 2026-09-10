---
id: backend-api-treatment-outcome
title: Treatment Outcome API
slug: /apps/backend/api/treatment-outcome
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/treatment-outcomes

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `TreatmentOutcomeController`

### POST /pms/organisation/:organisationId/treatment-outcomes

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `TreatmentOutcomeController`

### GET /pms/organisation/:organisationId/treatment-outcomes/:outcomeId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `TreatmentOutcomeController`

### PATCH /pms/organisation/:organisationId/treatment-outcomes/:outcomeId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `TreatmentOutcomeController`

### POST /pms/organisation/:organisationId/treatment-outcomes/:outcomeId/resolve

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `TreatmentOutcomeController`
