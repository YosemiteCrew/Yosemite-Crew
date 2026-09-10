---
id: backend-api-medication-reconciliation
title: Medication Reconciliation API
slug: /apps/backend/api/medication-reconciliation
---

Manages medication reconciliation records — the comparison of a patient's home medications against hospital/clinic orders to catch discrepancies (omitted, added, changed dose/frequency/route, duplicate, or contraindicated) at a transition of care. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation.

**Endpoints**

### GET /pms/organisation/:organisationId/medication-reconciliations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `status?`
- Controller: `MedicationReconciliationController.list`

### POST /pms/organisation/:organisationId/medication-reconciliations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `homeMedications` (array of `{name, dose?, frequency?, route?}`), `hospitalOrders` (array of `{name, dose?, frequency?, route?, orderedBy?}`), `discrepancies?` (array of `{type, medication, comment?}`), `notes?`
- Controller: `MedicationReconciliationController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/medication-reconciliations/:medRecId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `medRecId`
- Controller: `MedicationReconciliationController.get`

### PUT /pms/organisation/:organisationId/medication-reconciliations/:medRecId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `medRecId`
- Body fields: `homeMedications?`, `hospitalOrders?`, `discrepancies?`, `notes?`
- Controller: `MedicationReconciliationController.update`

### POST /pms/organisation/:organisationId/medication-reconciliations/:medRecId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `medRecId`
- Body fields: `discrepancies?`
- Controller: `MedicationReconciliationController.complete`

### POST /pms/organisation/:organisationId/medication-reconciliations/:medRecId/review

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `medRecId`
- Body fields: `reviewNotes?`
- Controller: `MedicationReconciliationController.review`
