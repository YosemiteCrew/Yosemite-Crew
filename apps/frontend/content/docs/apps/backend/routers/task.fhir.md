---
id: backend-api-task-fhir
title: Task Fhir API
slug: /apps/backend/api/task.fhir
---

API routes for the task fhir feature.

**Endpoints**

### GET /organisation/:organisationId

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`

### POST /organisation/:organisationId

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`

### GET /companion/:patientId

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`

### GET /organisation/:organisationId/:taskId

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`

### PATCH /organisation/:organisationId/:taskId

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`

### POST /String

- Auth: `requireWebAuth`
- Controller: `TaskFhirController`
