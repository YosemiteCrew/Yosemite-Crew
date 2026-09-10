---
id: backend-api-companion-history
title: Companion History API
slug: /apps/backend/api/companion-history
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/companion/:patientId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `CompanionHistoryController`
