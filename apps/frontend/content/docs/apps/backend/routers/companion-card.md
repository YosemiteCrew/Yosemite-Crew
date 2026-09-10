---
id: backend-api-companion-card
title: Companion Card API
slug: /apps/backend/api/companion-card
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/companion/:patientId/share

- Auth: `requireWebAuth`
- Permission: `companions:share:any`
- Controller: `CompanionCardController`

### GET /pms/organisation/:organisationId/companion/:patientId/shares

- Auth: `requireWebAuth`
- Permission: `companions:share:any`
- Controller: `CompanionCardController`

### DELETE /pms/organisation/:organisationId/share/:tokenId

- Auth: `requireWebAuth`
- Permission: `companions:share:any`
- Controller: `CompanionCardController`
