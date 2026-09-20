---
id: backend-api-patient-transfer
title: Patient Transfer API
slug: /apps/backend/api/patient-transfer
---

Manages a patient's transfer or referral record for the PIMS (Practice Information Management System, the clinic-facing web app): referring or discharging a patient to another facility or vet, carrying the clinical handoff details — diagnoses, ongoing treatments, dispensed medications, case summary, and critical alerts — that travel with them. All routes require organisation RBAC (role-based access control) permissions on `companions`.

**Endpoints**

### POST /pms/organisation/:organisationId/patient-transfers

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `transferType`, `receivingFacility`, `receivingVetName?`, `receivingVetContact?`, `transferredAt`, `transferredBy?`, `chiefComplaint?`, `currentDiagnoses?`, `ongoingTreatments?`, `medicationsDispensed?`, `caseSummary?`, `criticalAlerts?`, `ownerInformed?`
- Controller: `PatientTransferController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/patient-transfers

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `transferType?`
- Controller: `PatientTransferController.list`

### GET /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transferId`
- Controller: `PatientTransferController.get`

### PATCH /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transferId`
- Body fields: `encounterId?`, `transferType?`, `receivingFacility?`, `receivingVetName?`, `receivingVetContact?`, `transferredAt?`, `transferredBy?`, `chiefComplaint?`, `currentDiagnoses?`, `ongoingTreatments?`, `medicationsDispensed?`, `caseSummary?`, `criticalAlerts?`, `ownerInformed?`
- Controller: `PatientTransferController.update`

### DELETE /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transferId`
- Controller: `PatientTransferController.delete`
- Response: `204`: no content
