---
id: backend-api-treatment-protocol
title: Treatment Protocol API
slug: /apps/backend/api/treatment-protocol
---

Manages treatment protocol templates for the PIMS (Practice Information Management System, the clinic-facing web app): reusable, species- and category-scoped playbooks made up of steps (tasks, medications, services, or notes) that a clinician can apply to a patient's encounter. All routes are under the `/pms` namespace and require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/treatment-protocols

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `species`, `category`, `isActive`
- Controller: `TreatmentProtocolController.list`

### POST /pms/organisation/:organisationId/treatment-protocols

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `name`, `description`, `species`, `category`, `steps`
- Controller: `TreatmentProtocolController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Controller: `TreatmentProtocolController.get`

### PUT /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Body fields: `name`, `description`, `species`, `category`, `isActive`
- Controller: `TreatmentProtocolController.update`

### DELETE /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Controller: `TreatmentProtocolController.archive`
- Response: `204`: no content

### POST /pms/organisation/:organisationId/treatment-protocols/:protocolId/steps

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Body fields: `stepOrder`, `stepType`, `title`, `description`, `inventoryItemId`, `doseValue`, `doseUnit`, `routeOfAdmin`, `frequency`, `durationDays`, `assigneeRole`, `dueDaysFromStart`, `serviceCode`, `unitPrice`, `quantity`
- Controller: `TreatmentProtocolController.addStep`
- Response: `201`: JSON

### DELETE /pms/organisation/:organisationId/treatment-protocols/:protocolId/steps/:stepId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`, `stepId`
- Controller: `TreatmentProtocolController.removeStep`
- Response: `204`: no content

### POST /pms/organisation/:organisationId/treatment-protocols/:protocolId/apply

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Body fields: `encounterId`, `patientId`, `appointmentDate`
- Controller: `TreatmentProtocolController.apply`
- Response: `201`: JSON
