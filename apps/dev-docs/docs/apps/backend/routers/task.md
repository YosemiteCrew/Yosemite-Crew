---
id: backend-api-task
title: Task API
slug: /apps/backend/api/task
---

**Endpoints**

### POST /mobile/
- Auth: `authorizeCognitoMobile`
- Body: `CreateCustomTaskRequestBody`
- Body fields: `assignedTo`
- Controller: `TaskController.createCustomTask`
- Response: `403`: keys `message`, `201`: JSON

### GET /mobile/task
- Auth: `authorizeCognitoMobile`
- Controller: `TaskController.listParentTasks`

### GET /mobile/:taskId
- Auth: `authorizeCognitoMobile`
- Params: `taskId`
- Body: `TaskUpdateInput`
- Controller: `TaskController.updateTask`

### POST /mobile/:taskId/status
- Auth: `authorizeCognitoMobile`
- Params: `taskId`
- Body: `ChangeStatusRequestBody`
- Body fields: `status`, `completion`
- Controller: `TaskController.changeStatus`

### GET /mobile/companion/:companionId
- Auth: `authorizeCognitoMobile`
- Params: `companionId`
- Controller: `TaskController.listForCompanion`

### POST /pms/from-library
- Auth: `authorizeCognito`
- Body: `CreateFromLibraryRequestBody`
- Controller: `TaskController.createFromLibrary`
- Response: `201`: JSON

### POST /pms/from-template
- Auth: `authorizeCognito`
- Body: `CreateFromTemplateRequestBody`
- Controller: `TaskController.createFromTemplate`
- Response: `201`: JSON

### POST /pms/custom
- Auth: `authorizeCognito`
- Body: `CreateCustomTaskInput`
- Controller: `TaskController.createCustomTaskFromPms`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId
- Auth: `authorizeCognito`
- Params: `organisationId`
- Controller: `TaskController.listEmployeeTasks`

### GET /pms/companion/:companionId
- Auth: `authorizeCognito`
- Params: `companionId`
- Controller: `TaskController.listForCompanion`

### GET /pms/library
- Auth: `authorizeCognito`
- Controller: `TaskLibraryController.create`

### PUT /pms/library/:libraryId
- Auth: `authorizeCognito`
- Params: `libraryId`
- Controller: `TaskLibraryController.getById`

### GET /pms/templates/organisation/:organisationId
- Auth: `authorizeCognito`
- Params: `organisationId`
- Controller: `TaskTemplateController.list`

### GET /pms/templates/:templateId
- Auth: `authorizeCognito`
- Params: `templateId`
- Controller: `TaskTemplateController.getById`

### POST /pms/templates
- Auth: `authorizeCognito`
- Controller: `TaskTemplateController.update`

### DELETE /pms/templates/:templateId
- Auth: `authorizeCognito`
- Params: `templateId`
- Controller: `TaskTemplateController.archive`

### GET /pms/:taskId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Controller: `TaskController.getById`
- Response: `404`: keys `message`

### PATCH /pms/:taskId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Body: `TaskUpdateInput`
- Controller: `TaskController.updateTaskPMS`

### POST /pms/:taskId/status
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `taskId`
- Body: `ChangeStatusRequestBody`
- Body fields: `status`, `completion`
- Controller: `TaskController.changeStatus`
