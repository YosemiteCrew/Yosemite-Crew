---
id: backend-api-template
title: Template API
slug: /apps/backend/api/template
---

Plain JSON CRUD for templates — the reusable definitions behind form-style documents (SOAP notes, vital records, discharge summaries, prescriptions, consent, and so on) and task/workflow templates — plus creating and submitting instances of a template. This is the plain-JSON surface (`/v1/templates`) for these records; the [Template FHIR API](./template.fhir.md) exposes the same underlying templates and instances as FHIR `Questionnaire`/`PlanDefinition`/`QuestionnaireResponse` resources. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organisationId`, `kind`, `appointmentId`, `encounterId`, `companionId`, `species`, `serviceId`, `packageId`, `mode` (`OUTPATIENT`|`INPATIENT`), `ownerUserId` (`resolveTemplateSchema`; `ownerUserId` defaults to the caller's session id)
- Controller: `TemplateController.resolve`
- Response: `400`: keys `message` (or keys `message`, `issues` for a validation failure)

### GET /pms/templates/library

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `kind`, `status`, `scope`, `search`
- Controller: `TemplateController.listLibrary`
- Response: `200`: JSON array, narrowed to the template kinds the caller's `forms:view:any`/`tasks:view:any` permissions allow (empty array if neither is held)

### GET /pms/templates/organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`, `search`
- Controller: `TemplateController.listOrganisationTemplates`

### GET /pms/templates/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`, `search`
- Controller: `TemplateController.listUserTemplates`

### POST /pms/templates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `createTemplateSchema`
- Body fields: `organisationId`, `ownerUserId`, `ownership` (`ORG_TEMPLATE`|`USER_TEMPLATE`, default `ORG_TEMPLATE`), `kind`, `name`, `description`, `scope` (default `ORGANISATION`), `rules`, `schemaSnapshot`, `renderConfigSnapshot`, `validationSnapshot` (`createdBy`/`updatedBy` are set from the session)
- Controller: `TemplateController.create`
- Response: `400`: keys `message` (or keys `message`, `issues`), `201`: JSON

### GET /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateController.getById`

### PATCH /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: `updateTemplateSchema`
- Body fields: `name`, `description`, `ownership`, `scope`, `status`, `rules`, `schemaSnapshot`, `renderConfigSnapshot`, `validationSnapshot` (all optional; `updatedBy` is set from the session)
- Controller: `TemplateController.update`

### PATCH /pms/templates/organisation/:organisationId/:templateId/catalog-links

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: `updateTemplateCatalogLinksSchema`
- Body fields: `catalogItemIds`
- Controller: `TemplateController.updateCatalogLinks`

### POST /pms/templates/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateController.publish`

### DELETE /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateController.archive`

### POST /pms/templates/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: `createTemplateInstanceSchema`
- Body fields: `appointmentId`, `caseId`, `encounterId`, `data` (`organisationId` and `authorId` are set from the route/session, never the body)
- Controller: `TemplateController.createInstance`
- Response: `201`: JSON

### PATCH /pms/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: `updateTemplateInstanceSchema`
- Body fields: `data`, `status`, `signedBy`, `signedAt`, `generatedPdfUrl`, `generatedPdf`
- Controller: `TemplateController.updateInstance`

### POST /pms/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Controller: `TemplateController.submitInstance`
