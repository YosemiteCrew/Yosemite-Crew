---
id: backend-api-blood-transfusion
title: Blood Transfusion API
slug: /apps/backend/api/blood-transfusion
---

Manages blood transfusion records for a patient — product type, blood type, volume, crossmatch, pre/post PCV (packed cell volume), and any transfusion reaction — for the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. Route params and payloads are validated with Zod; an invalid path parameter returns `400` with a `message`, and a domain-specific failure returns the matching status with a `message` from the service.

**Endpoints**

### GET /pms/organisation/:organisationId/blood-transfusions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`
- Controller: `BloodTransfusionController.list`

### POST /pms/organisation/:organisationId/blood-transfusions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordBodySchema`
- Body fields: `patientId`, `encounterId`, `donorId`, `productType`, `bloodType`, `volumeMl`, `startedAt`, `endedAt`, `durationMinutes`, `reaction`, `reactionNotes`, `crossMatchDone`, `crossMatchResult`, `preTransfusionPCV`, `postTransfusionPCV`
- Controller: `BloodTransfusionController.record`
- Response: `201`: JSON (recorded transfusion)

### GET /pms/organisation/:organisationId/blood-transfusions/:transfusionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transfusionId`
- Controller: `BloodTransfusionController.get`

### POST /pms/organisation/:organisationId/blood-transfusions/:transfusionId/reaction

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transfusionId`
- Body: `ReactionBodySchema`
- Body fields: `reaction`, `reactionNotes`
- Controller: `BloodTransfusionController.reportReaction`

### PUT /pms/organisation/:organisationId/blood-transfusions/:transfusionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `transfusionId`
- Body: `UpdateBodySchema`
- Body fields: `endedAt`, `durationMinutes`, `reaction`, `reactionNotes`, `crossMatchResult`, `postTransfusionPCV`
- Controller: `BloodTransfusionController.update`
