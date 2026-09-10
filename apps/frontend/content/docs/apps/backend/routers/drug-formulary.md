---
id: backend-api-drug-formulary
title: Drug Formulary API
slug: /apps/backend/api/drug-formulary
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/drug-formulary

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `drugFormularyController`

### GET /pms/organisation/:organisationId/drug-formulary

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `drugFormularyController`

### GET /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `drugFormularyController`

### PATCH /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `drugFormularyController`

### DELETE /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `drugFormularyController`

### POST /pms/organisation/:organisationId/drug-formulary/:formularyId/dosages

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `drugFormularyController`

### DELETE /pms/organisation/:organisationId/drug-formulary/:formularyId/dosages/:dosageId

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `drugFormularyController`
