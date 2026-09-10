---
id: backend-api-integration
title: Integration API
slug: /apps/backend/api/integration
---

Manages an organisation's third-party integration accounts (for example IDEXX or another lab/PMS provider): listing configured integrations, viewing one by provider, storing its credentials, enabling/disabling it, and validating the stored credentials. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `IntegrationController.listForOrganisation`

### GET /pms/organisation/:organisationId/:provider

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `IntegrationController.getForOrganisation`
- Response: `404`: keys `message`

### POST /pms/organisation/:organisationId/:provider/credentials

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body fields: `credentials`, `config`
- Controller: `IntegrationController.updateCredentials`

### POST /pms/organisation/:organisationId/:provider/enable

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `IntegrationController.enable`

### POST /pms/organisation/:organisationId/:provider/disable

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `IntegrationController.disable`

### POST /pms/organisation/:organisationId/:provider/validate

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `IntegrationController.validate`
- Response: `200`: JSON (includes an `ok` boolean) when credentials are valid, `400`: same shape when they are not
