---
id: backend-api-blood-bank
title: Blood Bank API
slug: /apps/backend/api/blood-bank
---

Manages a practice's blood bank: donor registration and screening, and donation/collection records including crossmatch results, for the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. Route params and payloads are validated with Zod; an invalid path parameter returns `400` with a `message`, and a domain-specific failure returns the matching status with a `message` from the service.

**Endpoints**

### GET /pms/organisation/:organisationId/blood-bank/donors

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `bloodType`, `isActive`
- Controller: `BloodBankController.listDonors`

### POST /pms/organisation/:organisationId/blood-bank/donors

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RegisterDonorSchema`
- Body fields: `patientId`, `bloodType`, `lastScreeningAt`, `isActive`, `notes`
- Controller: `BloodBankController.registerDonor`
- Response: `201`: JSON (registered donor record)

### GET /pms/organisation/:organisationId/blood-bank/donors/:donorId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `donorId`
- Controller: `BloodBankController.getDonor`

### PUT /pms/organisation/:organisationId/blood-bank/donors/:donorId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `donorId`
- Body: `UpdateDonorSchema`
- Body fields: `bloodType`, `lastScreeningAt`, `lastDonationAt`, `nextEligibleAt`, `isActive`, `totalDonations`, `disqualificationReason`, `notes`
- Controller: `BloodBankController.updateDonor`

### GET /pms/organisation/:organisationId/blood-bank/donations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `donorId`, `status`
- Controller: `BloodBankController.listDonations`

### POST /pms/organisation/:organisationId/blood-bank/donations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordDonationSchema`
- Body fields: `donorId`, `collectedAt`, `volumeMl`, `anticoagulant`, `unitId`, `expiresAt`, `crossmatchResults`, `notes`
- Controller: `BloodBankController.recordDonation`
- Response: `201`: JSON (recorded donation record)

### GET /pms/organisation/:organisationId/blood-bank/donations/:donationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `donationId`
- Controller: `BloodBankController.getDonation`

### PUT /pms/organisation/:organisationId/blood-bank/donations/:donationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `donationId`
- Body: `UpdateDonationSchema`
- Body fields: `status`, `crossmatchResults`, `notes`
- Controller: `BloodBankController.updateDonation`
