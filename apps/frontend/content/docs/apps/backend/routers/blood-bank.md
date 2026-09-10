---
id: backend-api-blood-bank
title: Blood Bank API
slug: /apps/backend/api/blood-bank
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/blood-bank/donors

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodBankController`

### POST /pms/organisation/:organisationId/blood-bank/donors

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodBankController`

### GET /pms/organisation/:organisationId/blood-bank/donors/:donorId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodBankController`

### PUT /pms/organisation/:organisationId/blood-bank/donors/:donorId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodBankController`

### GET /pms/organisation/:organisationId/blood-bank/donations

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodBankController`

### POST /pms/organisation/:organisationId/blood-bank/donations

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodBankController`

### GET /pms/organisation/:organisationId/blood-bank/donations/:donationId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BloodBankController`

### PUT /pms/organisation/:organisationId/blood-bank/donations/:donationId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BloodBankController`
