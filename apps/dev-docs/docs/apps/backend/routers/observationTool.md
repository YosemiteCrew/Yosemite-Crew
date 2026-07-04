---
id: backend-api-observationTool
title: Observationtool API
slug: /apps/backend/api/observationTool
---

Manages observation tools: reusable structured questionnaires (a definition plus its typed fields) that a pet parent fills in, producing a submission that can be linked to an appointment or task. Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PMS (Practice Information Management System, the clinic-facing web app), which additionally authors and manages the tool definitions.

**Endpoints**

### GET /mobile/tools

- Auth: `authorizeCognitoMobile`
- Query: `category`, `onlyActive`
- Controller: `ObservationToolDefinitionController.list`

### GET /mobile/tools/:toolId

- Auth: `authorizeCognitoMobile`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.getById`

### POST /mobile/tools/:toolId/submissions

- Auth: `authorizeCognitoMobile`
- Params: `toolId`
- Controller: `ObservationToolSubmissionController.createFromMobile`

### POST /mobile/submissions/:submissionId/link-appointment

- Auth: `authorizeCognitoMobile`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.linkAppointment`

### GET /mobile/tasks/:taskId/preview

- Auth: `authorizeCognitoMobile`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getPreviewByTaskId`

### GET /pms/tools

- Auth: `authorizeCognito`
- Query: `category`, `onlyActive`
- Controller: `ObservationToolDefinitionController.list`

### GET /pms/tools/:toolId

- Auth: `authorizeCognito`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.getById`

### POST /pms/tools

- Auth: `authorizeCognito`
- Controller: `ObservationToolDefinitionController.create`
- Response: `201`: JSON

### PATCH /pms/tools/:toolId

- Auth: `authorizeCognito`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.update`

### POST /pms/tools/:toolId/archive

- Auth: `authorizeCognito`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.archive`
- Response: `204`: JSON

### GET /pms/submissions

- Auth: `authorizeCognito`
- Controller: `ObservationToolSubmissionController.listForPms`

### GET /pms/submissions/:submissionId

- Auth: `authorizeCognito`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.getById`

### POST /pms/submissions/:submissionId/link-appointment

- Auth: `authorizeCognito`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.linkAppointment`

### GET /pms/appointments/:appointmentId/submissions

- Auth: `authorizeCognito`
- Params: `appointmentId`
- Controller: `ObservationToolSubmissionController.listForAppointment`

### GET /pms/tasks/:taskId/submission

- Auth: `authorizeCognito`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getByTaskId`

### GET /pms/tasks/:taskId/preview

- Auth: `authorizeCognito`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getPreviewByTaskId`

### GET /pms/appointments/:appointmentId/task-previews

- Auth: `authorizeCognito`
- Params: `appointmentId`
- Controller: `ObservationToolSubmissionController.listTaskPreviewsForAppointment`
