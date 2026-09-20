---
id: backend-api-task-schedule.fhir
title: Task Schedule FHIR API
slug: /apps/backend/api/task-schedule.fhir
---

Manages the recurring task schedule generated when a PlanDefinition-style template instance is applied (see the [Template FHIR API](./template.fhir.md) for creating and publishing the `PlanDefinition` templates and their instances): listing an encounter's generated schedules, and applying, pausing, resuming, cancelling, or regenerating a template instance's schedule. Every operation returns the schedule as a FHIR `Task` resource, distinct from the individual tasks the schedule produces (see the [Task FHIR API](./task.fhir.md)). Mounted at `/fhir/v1/task-schedule`.

**Endpoints**

### GET /organisation/:organisationId/encounter/:encounterId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `TaskScheduleFhirController.listEncounterSchedules`
- Response: `200`: FHIR `Bundle` (type `searchset`) of schedule `Task` resources (callers holding only `tasks:view:own` see just their own schedules)

### POST /organisation/:organisationId/template-instance/:instanceId/\$apply

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `Parameters` resource (optional; recognised parameters `force`, `notify` (boolean), `deferUntil` (date))
- Controller: `TaskScheduleFhirController.apply`
- Response: `200`: FHIR `Task` resource representing the launched schedule

### POST /organisation/:organisationId/template-instance/:instanceId/\$pause

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Controller: `TaskScheduleFhirController.pause`
- Response: `200`: FHIR `Task` resource

### POST /organisation/:organisationId/template-instance/:instanceId/\$resume

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Controller: `TaskScheduleFhirController.resume`
- Response: `200`: FHIR `Task` resource

### POST /organisation/:organisationId/template-instance/:instanceId/\$cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Controller: `TaskScheduleFhirController.cancel`
- Response: `200`: FHIR `Task` resource

### POST /organisation/:organisationId/template-instance/:instanceId/\$regenerate

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `instanceId`
- Body: FHIR `Parameters` resource (optional; recognised parameters `notify`, `deferUntil` — `force` is always applied)
- Controller: `TaskScheduleFhirController.regenerate`
- Response: `200`: FHIR `Task` resource representing the regenerated schedule
