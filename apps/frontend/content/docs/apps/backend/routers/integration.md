---
id: backend-api-integration
title: Integration API
slug: /apps/backend/api/integration
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `IntegrationController`

### GET /pms/organisation/:organisationId/:provider

- Auth: `requireWebAuth`
- Permission: `integrations:view:any`
- Controller: `IntegrationController`

### POST /pms/organisation/:organisationId/:provider/credentials

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `IntegrationController`

### POST /pms/organisation/:organisationId/:provider/enable

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `IntegrationController`

### POST /pms/organisation/:organisationId/:provider/disable

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `IntegrationController`

### POST /pms/organisation/:organisationId/:provider/validate

- Auth: `requireWebAuth`
- Permission: `integrations:edit:any`
- Controller: `IntegrationController`
