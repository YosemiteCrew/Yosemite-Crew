---
id: backend-api-emergency-triage
title: Emergency Triage API
slug: /apps/backend/api/emergency-triage
---

Records emergency triage assessments for a patient — presenting complaint, vitals, and priority — and lets a clinician escalate one to a higher priority. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation and not-found errors from the service layer come back as `{ message }`.

**Endpoints**

### GET /pms/organisation/:organisationId/emergency-triage

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `from`, `to`
- Controller: `EmergencyTriageController.list`

### POST /pms/organisation/:organisationId/emergency-triage

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordBodySchema`
- Body fields: `patientId`, `encounterId`, `triagePriority` (`IMMEDIATE`, `URGENT`, `LESS_URGENT`, `STANDARD`, `NON_URGENT`), `chiefComplaint`, `presentationAt`, `heartRate`, `respiratoryRate`, `temperature`, `bloodPressureSystolic`, `bloodPressureDiastolic`, `oxygenSaturation`, `capillaryRefillTime`, `mentalStatus`, `notes`
- Controller: `EmergencyTriageController.record`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/emergency-triage/:triageId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `triageId`
- Controller: `EmergencyTriageController.get`

### POST /pms/organisation/:organisationId/emergency-triage/:triageId/escalate

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `triageId`
- Body: `{ escalatedReason: string }`
- Controller: `EmergencyTriageController.escalate`
