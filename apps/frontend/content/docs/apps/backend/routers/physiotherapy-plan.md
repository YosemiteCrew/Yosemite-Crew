---
id: backend-api-physiotherapy-plan
title: Physiotherapy Plan API
slug: /apps/backend/api/physiotherapy-plan
---

Manages a patient's physiotherapy plan in the PIMS (Practice Information Management System, the clinic-facing web app) — the prescribed modalities (hydrotherapy, laser therapy, therapeutic ultrasound, massage, acupuncture, tape application), session schedule, exercise prescription, and home-exercise instructions. A plan tracks status through `ACTIVE`, `ON_HOLD`, `COMPLETED`, or `DISCONTINUED`. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/physiotherapy-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `status`
- Controller: `PhysiotherapyPlanController.list`

### POST /pms/organisation/:organisationId/physiotherapy-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `surgicalProcedureId`, `diagnosis`, `goals`, `frequency`, `durationMinutes`, `totalSessions`, `exercisePrescription`, `hydrotherapy`, `laserTherapy`, `therapeuticUltrasound`, `massage`, `acupuncture`, `tapeApplication`, `precautions`, `homeExercises`, `startDate`, `endDate`, `nextSessionAt`, `therapist`, `notes` (`patientId` and `diagnosis` are required, the rest optional; `lastSessionAt` and `status` cannot be set on create)
- Controller: `PhysiotherapyPlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/physiotherapy-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `PhysiotherapyPlanController.get`

### PUT /pms/organisation/:organisationId/physiotherapy-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `PlanFieldsSchema`
- Body fields: `diagnosis`, `goals`, `frequency`, `durationMinutes`, `totalSessions`, `exercisePrescription`, `hydrotherapy`, `laserTherapy`, `therapeuticUltrasound`, `massage`, `acupuncture`, `tapeApplication`, `precautions`, `homeExercises`, `startDate`, `endDate`, `lastSessionAt`, `nextSessionAt`, `therapist`, `status`, `notes` (all optional)
- Controller: `PhysiotherapyPlanController.update`
