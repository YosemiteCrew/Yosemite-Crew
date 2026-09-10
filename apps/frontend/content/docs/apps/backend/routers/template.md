---
id: backend-api-template
title: Template API
slug: /apps/backend/api/template
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/resolve

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### GET /pms/templates/library

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### GET /pms/templates/organisation/:organisationId

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### GET /pms/templates/organisation/:organisationId/users/me

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### POST /pms/templates

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### GET /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### PATCH /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### DELETE /pms/templates/organisation/:organisationId/:templateId

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### PATCH /pms/templates/organisation/:organisationId/:templateId/catalog-links

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### POST /pms/templates/organisation/:organisationId/:templateId/publish

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### POST /pms/templates/organisation/:organisationId/:templateId/instances

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### PATCH /pms/template-instances/organisation/:organisationId/:instanceId

- Auth: `requireWebAuth`
- Controller: `TemplateController`

### POST /pms/template-instances/organisation/:organisationId/:instanceId/submit

- Auth: `requireWebAuth`
- Controller: `TemplateController`
