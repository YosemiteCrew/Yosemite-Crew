---
id: backend-api-post-op-care-plan
title: Post-Op Care Plan API
slug: /apps/backend/api/post-op-care-plan
---

Manages a patient's post-operative care plan in the PIMS (Practice Information Management System, the clinic-facing web app) — pain score, analgesia protocol, wound-care instructions, activity restrictions, dietary and fluid-therapy notes, and scheduled reviews after surgery. A plan tracks status through `ACTIVE`, `COMPLETED`, or `CANCELLED`, and a dedicated review endpoint records a follow-up check without a full update. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/post-op-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `status`
- Controller: `PostOpCarePlanController.list`

### POST /pms/organisation/:organisationId/post-op-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `surgicalProcedureId`, `painScore` (0-10), `analgesiaProtocol`, `woundCareInstructions`, `activityRestrictions`, `dietaryNotes`, `fluidTherapyNotes`, `monitoringParams`, `firstReviewAt`, `nextReviewAt`, `notes` (`patientId` is required, the rest optional)
- Controller: `PostOpCarePlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/post-op-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `PostOpCarePlanController.get`

### POST /pms/organisation/:organisationId/post-op-care-plans/:planId/review

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `ReviewBodySchema`
- Body fields: `painScore` (0-10), `reviewNotes`, `nextReviewAt`, `status` (`reviewNotes` is required, the rest optional)
- Controller: `PostOpCarePlanController.review`

### PUT /pms/organisation/:organisationId/post-op-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `UpdateBodySchema`
- Body fields: `analgesiaProtocol`, `woundCareInstructions`, `activityRestrictions`, `dietaryNotes`, `fluidTherapyNotes`, `monitoringParams`, `firstReviewAt`, `nextReviewAt`, `notes`, `status` (all optional)
- Controller: `PostOpCarePlanController.update`
