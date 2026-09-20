---
id: backend-api-template.fhir
title: Template FHIR API
slug: /apps/backend/api/template.fhir
---

Exposes the same templates as the [Template API](./template.md) (`/v1/templates`) as FHIR resources instead of plain JSON: form-style templates as the `Questionnaire` resource, task/workflow templates as the `PlanDefinition` resource, and instances of either kind as `QuestionnaireResponse`. A route only acts on templates of its own family — a `PlanDefinition` route 400s a form-style template id, and vice versa. Mounted at `/fhir/v1/template`.

**Endpoints**

### GET /questionnaire/library

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listQuestionnaires`
- Response: `200`: FHIR `Bundle` of `Questionnaire` resources (the shared library, filtered to questionnaire-style template kinds)

### GET /questionnaire/organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listOrganisationQuestionnaires`
- Response: `200`: FHIR `Bundle` of `Questionnaire` resources

### GET /questionnaire/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listUserQuestionnaires`
- Response: `200`: FHIR `Bundle` of `Questionnaire` resources

### POST /questionnaire

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `Questionnaire` resource (`resourceType: "Questionnaire"`)
- Controller: `TemplateFhirController.createQuestionnaire`
- Response: `400`: keys `message` (resource maps to a non-questionnaire template kind), `201`: FHIR `Questionnaire` resource

### GET /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.getQuestionnaire`
- Response: `404`: keys `message` (template exists but is not a questionnaire-style kind), `200`: FHIR `Questionnaire` resource

### PATCH /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: FHIR `Questionnaire` resource
- Controller: `TemplateFhirController.updateQuestionnaire`
- Response: `400`: keys `message`, `200`: FHIR `Questionnaire` resource

### POST /questionnaire/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.publishQuestionnaire`
- Response: `404`: keys `message`, `200`: FHIR `Questionnaire` resource

### DELETE /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.archiveQuestionnaire`
- Response: `404`: keys `message`, `200`: FHIR `Questionnaire` resource

### POST /questionnaire/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.createQuestionnaireInstance`
- Response: `201`: FHIR `QuestionnaireResponse` resource

### PATCH /questionnaire/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.updateQuestionnaireInstance`
- Response: `200`: FHIR `QuestionnaireResponse` resource

### POST /questionnaire/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.submitQuestionnaireInstance`
- Response: `200`: FHIR `QuestionnaireResponse` resource (instance is marked `COMPLETED`)

### GET /plan-definition/library

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listPlanDefinitions`
- Response: `200`: FHIR `Bundle` of `PlanDefinition` resources (the shared library, filtered to workflow-style template kinds)

### GET /plan-definition/organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listOrganisationPlanDefinitions`
- Response: `200`: FHIR `Bundle` of `PlanDefinition` resources

### GET /plan-definition/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `kind`, `status`, `scope`
- Controller: `TemplateFhirController.listUserPlanDefinitions`
- Response: `200`: FHIR `Bundle` of `PlanDefinition` resources

### POST /plan-definition

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: FHIR `PlanDefinition` resource (`resourceType: "PlanDefinition"`)
- Controller: `TemplateFhirController.createPlanDefinition`
- Response: `400`: keys `message` (resource maps to a non-workflow template kind), `201`: FHIR `PlanDefinition` resource

### GET /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.getPlanDefinition`
- Response: `404`: keys `message` (template exists but is not a workflow-style kind), `200`: FHIR `PlanDefinition` resource

### PATCH /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: FHIR `PlanDefinition` resource
- Controller: `TemplateFhirController.updatePlanDefinition`
- Response: `400`: keys `message`, `200`: FHIR `PlanDefinition` resource

### POST /plan-definition/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.publishPlanDefinition`
- Response: `404`: keys `message`, `200`: FHIR `PlanDefinition` resource

### DELETE /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Controller: `TemplateFhirController.archivePlanDefinition`
- Response: `404`: keys `message`, `200`: FHIR `PlanDefinition` resource

### POST /plan-definition/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `templateId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.createPlanDefinitionInstance`
- Response: `201`: FHIR `QuestionnaireResponse` resource

### PATCH /plan-definition/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.updatePlanDefinitionInstance`
- Response: `200`: FHIR `QuestionnaireResponse` resource

### POST /plan-definition/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `QuestionnaireResponse` resource
- Controller: `TemplateFhirController.submitPlanDefinitionInstance`
- Response: `200`: FHIR `QuestionnaireResponse` resource (instance is marked `COMPLETED`)
