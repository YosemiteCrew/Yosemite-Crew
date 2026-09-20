---
id: backend-api-referral-letter
title: Referral Letter API
slug: /apps/backend/api/referral-letter
---

Manages a patient's referral letter to an outside specialist in the PIMS (Practice Information Management System, the clinic-facing web app) — the specialist's details, the reason for referral, history and exam findings, current medications, and notes. A letter moves through `DRAFT`, `SIGNED`, `SENT`, `ACKNOWLEDGED`, or `CANCELLED` only via the dedicated sign/send/cancel action endpoints below, not through the update endpoint. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/referral-letters

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `status`
- Controller: `ReferralLetterController.list`

### POST /pms/organisation/:organisationId/referral-letters

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `specialistName`, `specialistClinic`, `specialistEmail`, `reasonForReferral`, `historySummary`, `examFindings`, `currentMedications`, `additionalNotes` (`patientId` and `reasonForReferral` are required, the rest optional)
- Controller: `ReferralLetterController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/referral-letters/:letterId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `letterId`
- Controller: `ReferralLetterController.get`

### PUT /pms/organisation/:organisationId/referral-letters/:letterId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `letterId`
- Body: `UpdateBodySchema`
- Body fields: `specialistName`, `specialistClinic`, `specialistEmail`, `reasonForReferral`, `historySummary`, `examFindings`, `currentMedications`, `additionalNotes` (all optional)
- Controller: `ReferralLetterController.update`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/sign

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `letterId`
- Controller: `ReferralLetterController.sign`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/send

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `letterId`
- Controller: `ReferralLetterController.send`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `letterId`
- Controller: `ReferralLetterController.cancel`
