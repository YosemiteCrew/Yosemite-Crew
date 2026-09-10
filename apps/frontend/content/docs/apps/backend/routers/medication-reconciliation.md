---
id: backend-api-medication-reconciliation
title: Medication Reconciliation API
slug: /apps/backend/api/medication-reconciliation
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/medication-reconciliations

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `MedicationReconciliationController`

### POST /pms/organisation/:organisationId/medication-reconciliations

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `MedicationReconciliationController`

### GET /pms/organisation/:organisationId/medication-reconciliations/:medRecId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `MedicationReconciliationController`

### PUT /pms/organisation/:organisationId/medication-reconciliations/:medRecId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `MedicationReconciliationController`

### POST /pms/organisation/:organisationId/medication-reconciliations/:medRecId/complete

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `MedicationReconciliationController`

### POST /pms/organisation/:organisationId/medication-reconciliations/:medRecId/review

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `MedicationReconciliationController`
