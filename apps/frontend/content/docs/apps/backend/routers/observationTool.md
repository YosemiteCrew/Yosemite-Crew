---
id: backend-api-observationTool
title: Observationtool API
slug: /apps/backend/api/observationTool
---

Manages observation tools: reusable structured questionnaires (a definition plus its typed fields) that a pet parent fills in, producing a submission that can be linked to an appointment or task. Routes under `/mobile` are called by the mobile app on behalf of a pet parent; routes under `/pms` are called by the PIMS (Practice Information Management System, the clinic-facing web app), which additionally authors and manages the tool definitions.

**Endpoints**

### GET /mobile/tools

- Auth: `requireMobileAuth`
- Query: `category`, `onlyActive`
- Controller: `ObservationToolDefinitionController.list`

### GET /mobile/tools/:toolId

- Auth: `requireMobileAuth`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.getById`

### POST /mobile/tools/:toolId/submissions

- Auth: `requireMobileAuth`
- Params: `toolId`
- Controller: `ObservationToolSubmissionController.createFromMobile`

### POST /mobile/submissions/:submissionId/link-appointment

- Auth: `requireMobileAuth`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.linkAppointment`

### GET /mobile/tasks/:taskId/preview

- Auth: `requireMobileAuth`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getPreviewByTaskId`

### GET /pms/tools

- Auth: `requireWebAuth`
- Query: `category`, `onlyActive`
- Controller: `ObservationToolDefinitionController.list`

### GET /pms/tools/:toolId

- Auth: `requireWebAuth`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.getById`

### POST /pms/tools

- Auth: `requireWebAuth`
- Controller: `ObservationToolDefinitionController.create`
- Response: `201`: JSON

### PATCH /pms/tools/:toolId

- Auth: `requireWebAuth`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.update`

### POST /pms/tools/:toolId/archive

- Auth: `requireWebAuth`
- Params: `toolId`
- Controller: `ObservationToolDefinitionController.archive`
- Response: `204`: JSON

### GET /pms/submissions

- Auth: `requireWebAuth`
- Controller: `ObservationToolSubmissionController.listForPms`

### GET /pms/submissions/:submissionId

- Auth: `requireWebAuth`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.getById`

### POST /pms/submissions/:submissionId/link-appointment

- Auth: `requireWebAuth`
- Params: `submissionId`
- Controller: `ObservationToolSubmissionController.linkAppointment`

### GET /pms/appointments/:appointmentId/submissions

- Auth: `requireWebAuth`
- Params: `appointmentId`
- Controller: `ObservationToolSubmissionController.listForAppointment`

### GET /pms/tasks/:taskId/submission

- Auth: `requireWebAuth`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getByTaskId`

### GET /pms/tasks/:taskId/preview

- Auth: `requireWebAuth`
- Params: `taskId`
- Controller: `ObservationToolSubmissionController.getPreviewByTaskId`

### GET /pms/appointments/:appointmentId/task-previews

- Auth: `requireWebAuth`
- Params: `appointmentId`
- Controller: `ObservationToolSubmissionController.listTaskPreviewsForAppointment`
