---
id: backend-api-task
title: Task API
slug: /apps/backend/api/task
---

Manages tasks and the libraries and templates they are created from: creating, listing, updating, and changing the status of tasks. Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app). See the [Observation Tool API](./observationTool.md) for submissions that can be linked to a task.

**Endpoints**

### POST /mobile/

- Auth: `requireMobileAuth`
- Body: `CreateCustomTaskRequestBody`
- Body fields: `assignedTo`
- Controller: `TaskController.createCustomTask`
- Response: `403`: keys `message`, `201`: JSON

### GET /mobile/task

- Auth: `requireMobileAuth`
- Controller: `TaskController.listParentTasks`

### GET /mobile/:taskId

- Auth: `requireMobileAuth`
- Params: `taskId`
- Body: `TaskUpdateInput`
- Controller: `TaskController.updateTask`

### POST /mobile/:taskId/status

- Auth: `requireMobileAuth`
- Params: `taskId`
- Body: `ChangeStatusRequestBody`
- Body fields: `status`, `completion`
- Controller: `TaskController.changeStatus`

### GET /mobile/companion/:companionId

- Auth: `requireMobileAuth`
- Params: `companionId`
- Controller: `TaskController.listForCompanion`

### POST /pms/from-library

- Auth: `requireWebAuth`
- Body: `CreateFromLibraryRequestBody`
- Controller: `TaskController.createFromLibrary`
- Response: `201`: JSON

### POST /pms/from-template

- Auth: `requireWebAuth`
- Body: `CreateFromTemplateRequestBody`
- Controller: `TaskController.createFromTemplate`
- Response: `201`: JSON

### POST /pms/custom

- Auth: `requireWebAuth`
- Body: `CreateCustomTaskInput`
- Controller: `TaskController.createCustomTaskFromPms`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId

- Auth: `requireWebAuth`
- Params: `organisationId`
- Controller: `TaskController.listEmployeeTasks`

### GET /pms/companion/:companionId

- Auth: `requireWebAuth`
- Params: `companionId`
- Controller: `TaskController.listForCompanion`

### GET /pms/library

- Auth: `requireWebAuth`
- Controller: `TaskLibraryController.create`

### PUT /pms/library/:libraryId

- Auth: `requireWebAuth`
- Params: `libraryId`
- Controller: `TaskLibraryController.getById`

### GET /pms/templates/organisation/:organisationId

- Auth: `requireWebAuth`
- Params: `organisationId`
- Controller: `TaskTemplateController.list`

### GET /pms/templates/:templateId

- Auth: `requireWebAuth`
- Params: `templateId`
- Controller: `TaskTemplateController.getById`

### POST /pms/templates

- Auth: `requireWebAuth`
- Controller: `TaskTemplateController.update`

### DELETE /pms/templates/:templateId

- Auth: `requireWebAuth`
- Params: `templateId`
- Controller: `TaskTemplateController.archive`

### GET /pms/:taskId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Controller: `TaskController.getById`
- Response: `404`: keys `message`

### PATCH /pms/:taskId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Body: `TaskUpdateInput`
- Controller: `TaskController.updateTaskPMS`

### POST /pms/:taskId/status

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Body: `ChangeStatusRequestBody`
- Body fields: `status`, `completion`
- Controller: `TaskController.changeStatus`
