---
id: backend-api-discharge-instruction
title: Discharge Instruction API
slug: /apps/backend/api/discharge-instruction
---

Manages take-home discharge instructions for a patient (medication schedule, dietary and activity notes, wound care, follow-up), including sending them to the client and recording acknowledgement. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation and not-found errors from the service layer come back as `{ message }`.

**Endpoints**

### GET /pms/organisation/:organisationId/discharge-instructions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `status` (`DRAFT`, `SENT`, `ACKNOWLEDGED`)
- Controller: `DischargeInstructionController.list`

### POST /pms/organisation/:organisationId/discharge-instructions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `medicationSchedule`, `dietaryNotes`, `activityNotes`, `woundCareNotes`, `warningSigns`, `followUpDate`, `followUpNotes`, `emergencyContact`, `additionalNotes`
- Controller: `DischargeInstructionController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/discharge-instructions/:dischargeId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeId`
- Controller: `DischargeInstructionController.get`

### PUT /pms/organisation/:organisationId/discharge-instructions/:dischargeId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeId`
- Body: `UpdateBodySchema`
- Body fields: `medicationSchedule`, `dietaryNotes`, `activityNotes`, `woundCareNotes`, `warningSigns`, `followUpDate`, `followUpNotes`, `emergencyContact`, `additionalNotes`
- Controller: `DischargeInstructionController.update`

### POST /pms/organisation/:organisationId/discharge-instructions/:dischargeId/send

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeId`
- Controller: `DischargeInstructionController.send`

### POST /pms/organisation/:organisationId/discharge-instructions/:dischargeId/acknowledge

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (gated on the edit scope, since acknowledgement mutates state)
- Params: `organisationId`, `dischargeId`
- Controller: `DischargeInstructionController.acknowledge`
