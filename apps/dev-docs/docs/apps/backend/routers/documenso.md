---
id: backend-api-documenso
title: Documenso API
slug: /apps/backend/api/documenso
---

**Endpoints**

### POST /pms/redirect/:orgId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `DocumensoAuthController.createRedirectUrl`

### POST /pms/store-api-key/:orgId
- Params: `orgId`
- Controller: `DocumensoKeyController.storeApiKey`
