---
id: backend-api-task.fhir
title: Task FHIR API
slug: /apps/backend/api/task.fhir
---

Exposes tasks as the FHIR `Task` resource: listing an organisation's employee tasks or a companion's (patient's) tasks, creating and updating a task from a `Task` resource, fetching one, and changing its status through the FHIR `$status` operation. This is a separate surface from the [Task API](./task.md), which is the plain JSON CRUD surface (`/v1/task`) for the same underlying tasks and their libraries/templates — this router is mounted at `/fhir/v1/task` and both request bodies and responses are FHIR `Task` resources rather than the plain-JSON shapes `TaskController` uses.

**Endpoints**

### GET /organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `status`, `audience`
- Controller: `TaskFhirController.listEmployeeTasks`
- Response: `403`: keys `message` (caller lacks `tasks:view:any` and has no verified session id), `200`: FHIR `Bundle` of `Task` resources

### GET /companion/:patientId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `patientId`
- Query: `status`, `audience` (`EMPLOYEE_TASK`|`PARENT_TASK`)
- Controller: `TaskFhirController.listCompanionTasks`
- Response: `400`: keys `message` (no organisation on the authorized request), `200`: FHIR `Bundle` of `Task` resources

### POST /organisation/:organisationId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: FHIR `Task` resource (`resourceType: "Task"`)
- Controller: `TaskFhirController.create`
- Response: `201`: FHIR `Task` resource

### GET /organisation/:organisationId/:taskId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `taskId`
- Controller: `TaskFhirController.getById`
- Response: `404`: keys `message` (task not found), `403`: keys `message` (wrong organisation, or caller lacks `tasks:view:any` and is neither assignee nor creator), `200`: FHIR `Task` resource

### PATCH /organisation/:organisationId/:taskId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `taskId`
- Body: FHIR `Task` resource
- Controller: `TaskFhirController.update`
- Response: `404`: keys `message`, `403`: keys `message`, `200`: FHIR `Task` resource

### POST /organisation/:organisationId/:taskId/\$status

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `taskId`
- Body: FHIR `Task` resource (only `status` is read)
- Controller: `TaskFhirController.changeStatus`
- Response: `404`: keys `message`, `403`: keys `message`, `200`: FHIR `Task` resource
