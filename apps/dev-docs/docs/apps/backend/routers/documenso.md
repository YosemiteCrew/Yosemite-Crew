---
id: backend-api-documenso
title: Documenso API
slug: /apps/backend/api/documenso
---

Integrates with Documenso, an open-source document e-signature service. Called by the PIMS (Practice Information Management System, the clinic-facing web app) to obtain a signing redirect URL and to store an organisation's Documenso API key.

**Endpoints**

### POST /pms/redirect/:orgId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `DocumensoAuthController.createRedirectUrl`

### POST /pms/store-api-key/:orgId

- Params: `orgId`
- Controller: `DocumensoKeyController.storeApiKey`
