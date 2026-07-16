---
id: backend-api-organisation-document
title: Organisation Document API
slug: /apps/backend/api/organisation-document
---

Manages an organisation's documents and policies (upload, create, update, delete, list) plus policy upsert. The `/pms` routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions; the `/mobile` route lets the mobile app list the documents an organisation has published publicly.

**Endpoints**

### POST /pms/:orgId/documents/upload

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `OrganizationDocumentController.uploadFile`
- Response: `400`: keys `message`, `200`: keys `s3Key`, `uploadUrl`, `500`: keys `message`

### POST /pms/:orgId/documents

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Body: `CreateOrgDocumentBody`
- Controller: `OrganizationDocumentController.create`

### PATCH /pms/:orgId/documents/:documentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `documentId`
- Body: `UpdateOrgDocumentBody`
- Controller: `OrganizationDocumentController.update`

### DELETE /pms/:orgId/documents/:documentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `documentId`
- Controller: `OrganizationDocumentController.remove`

### GET /pms/:orgId/documents

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Controller: `OrganizationDocumentController.list`

### GET /pms/:orgId/documents/:documentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`, `documentId`
- Controller: `OrganizationDocumentController.getById`

### POST /pms/:orgId/documents/policy

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `orgId`
- Body: `UpsertPolicyBody`
- Controller: `OrganizationDocumentController.upsertPolicy`

### GET /mobile/:orgId/documents

- Auth: `authorizeCognitoMobile`
- Params: `orgId`
- Controller: `OrganizationDocumentController.listPublic`
