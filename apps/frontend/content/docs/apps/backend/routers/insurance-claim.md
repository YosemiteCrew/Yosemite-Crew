---
id: backend-api-insurance-claim
title: Insurance Claim API
slug: /apps/backend/api/insurance-claim
---

Manages pet-insurance claims raised against an invoice or encounter: creation, editing, submission to the insurer, status tracking, and cancellation. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/insurance-claims

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `status`, `invoiceId`
- Controller: `InsuranceClaimController.list`

### POST /pms/organisation/:organisationId/insurance-claims

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `invoiceId`, `encounterId`, `insurerName`, `policyNumber`, `submittedAmount`, `currency`, `notes`
- Controller: `InsuranceClaimController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/insurance-claims/:claimId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `claimId`
- Controller: `InsuranceClaimController.get`

### PUT /pms/organisation/:organisationId/insurance-claims/:claimId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `claimId`
- Body: `UpdateBodySchema`
- Body fields: `insurerName`, `policyNumber`, `claimNumber`, `submittedAmount`, `notes`, `externalClaimRef` (all optional)
- Controller: `InsuranceClaimController.update`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/submit

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `claimId`
- Controller: `InsuranceClaimController.submit`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/status

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `claimId`
- Body: `UpdateStatusBodySchema`
- Body fields: `status` (`DRAFT`|`SUBMITTED`|`UNDER_REVIEW`|`APPROVED`|`PARTIALLY_APPROVED`|`REJECTED`|`PAID`|`CANCELLED`), `approvedAmount`, `paidAmount`, `rejectionReason`, `claimNumber`, `externalClaimRef`
- Controller: `InsuranceClaimController.updateStatus`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `claimId`
- Controller: `InsuranceClaimController.cancel`
