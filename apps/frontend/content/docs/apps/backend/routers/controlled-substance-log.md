---
id: backend-api-controlled-substance-log
title: Controlled Substance Log API
slug: /apps/backend/api/controlled-substance-log
---

Records the DEA (Drug Enforcement Administration) controlled-drug register for an organisation in the PIMS (Practice Information Management System) — each entry logs a schedule II-V drug draw, the amount administered and wasted, and a witness for wasted quantity, forming the audit trail regulators expect. Creating an entry, correcting one, and reading the register are gated by three distinct permissions (`controlled-drug-register:record`, `controlled-drug-register:correct`, `controlled-drug-register:read`); a correction is captured as an update rather than an edit-in-place, and the authenticated caller is always recorded as the actor (`administeredBy` on create, `correctedBy` on update, `voidedBy` on delete) regardless of what the body sends.

**Endpoints**

### GET /pms/organisation/:organisationId/controlled-substance-logs

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `drug`, `deaSchedule`, `fromDate`, `toDate`
- Controller: `ControlledSubstanceLogController.list`

### POST /pms/organisation/:organisationId/controlled-substance-logs

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId`, `loggedAt`, `drug`, `deaSchedule`, `lotNumber`, `strength`, `unit`, `amountDrawn`, `amountAdministered`, `amountWasted`, `wastedWitness`, `balanceBefore`, `balanceAfter`, `notes`
- Controller: `ControlledSubstanceLogController.create`
- Response: `201`: JSON — the created log entry

### GET /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `logId`
- Controller: `ControlledSubstanceLogController.get`

### PUT /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `logId`
- Body fields: `lotNumber`, `strength`, `amountDrawn`, `amountAdministered`, `amountWasted`, `wastedWitness`, `balanceBefore`, `balanceAfter`, `administeredBy`, `notes`
- Controller: `ControlledSubstanceLogController.update`

### DELETE /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `logId`
- Controller: `ControlledSubstanceLogController.delete`
- Response: `204`: no content
