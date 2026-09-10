---
id: backend-api-knowledge
title: Knowledge API
slug: /apps/backend/api/knowledge
---

Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/merck/manuals/search

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Rate limit: rate-limited
- Controller: `MerckController`

### GET /mobile/merck/manuals/search

- Auth: `requireMobileAuth`
- Rate limit: rate-limited
- Controller: `MerckMobileController`
