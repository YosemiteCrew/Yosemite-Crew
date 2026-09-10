---
id: backend-api-referral-letter
title: Referral Letter API
slug: /apps/backend/api/referral-letter
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/referral-letters

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ReferralLetterController`

### POST /pms/organisation/:organisationId/referral-letters

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReferralLetterController`

### GET /pms/organisation/:organisationId/referral-letters/:letterId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ReferralLetterController`

### PUT /pms/organisation/:organisationId/referral-letters/:letterId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReferralLetterController`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/sign

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReferralLetterController`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/send

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReferralLetterController`

### POST /pms/organisation/:organisationId/referral-letters/:letterId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReferralLetterController`
