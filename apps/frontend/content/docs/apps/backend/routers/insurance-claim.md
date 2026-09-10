---
id: backend-api-insurance-claim
title: Insurance Claim API
slug: /apps/backend/api/insurance-claim
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/insurance-claims

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `InsuranceClaimController`

### POST /pms/organisation/:organisationId/insurance-claims

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `InsuranceClaimController`

### GET /pms/organisation/:organisationId/insurance-claims/:claimId

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `InsuranceClaimController`

### PUT /pms/organisation/:organisationId/insurance-claims/:claimId

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `InsuranceClaimController`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/submit

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `InsuranceClaimController`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/status

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `InsuranceClaimController`

### POST /pms/organisation/:organisationId/insurance-claims/:claimId/cancel

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `InsuranceClaimController`
