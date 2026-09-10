---
id: backend-api-template-fhir
title: Template Fhir API
slug: /apps/backend/api/template.fhir
---

API routes for the template fhir feature.

**Endpoints**

### GET /questionnaire/library

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /questionnaire/organisation/:organisationId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /questionnaire/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /questionnaire

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### PATCH /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### DELETE /questionnaire/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /questionnaire/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /questionnaire/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### PATCH /questionnaire/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /questionnaire/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /plan-definition/library

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /plan-definition/organisation/:organisationId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /plan-definition/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /plan-definition

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### GET /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### PATCH /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### DELETE /plan-definition/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /plan-definition/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /plan-definition/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### PATCH /plan-definition/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`

### POST /plan-definition/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- Controller: `TemplateFhirController`
