---
id: backend-api-aftercare-plan
title: Aftercare Plan API
slug: /apps/backend/api/aftercare-plan
---

Manages end-of-life aftercare plans for a patient (euthanasia service, cremation, aquamation, burial, home care, or donation to science), recorded by the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. Route params and payloads are validated with Zod; an invalid path parameter returns `400` with a `message`, and a domain-specific failure (for example, a plan that does not belong to the given organisation) returns the matching status with a `message` from the service.

**Endpoints**

### GET /pms/organisation/:organisationId/aftercare-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `type`, `completed`
- Controller: `AftercarePlanController.list`

### POST /pms/organisation/:organisationId/aftercare-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `type`, `provider`, `estimatedCost`, `depositPaid`, `pawPrintRequested`, `furClippingRequested`, `urnsRequested`, `instructions`, `certificateNumber`, `completedAt`, `notes`
- Controller: `AftercarePlanController.create`
- Response: `201`: JSON (created aftercare plan record)

### GET /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `AftercarePlanController.get`

### PUT /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `UpdateBodySchema`
- Body fields: `provider`, `estimatedCost`, `depositPaid`, `pawPrintRequested`, `furClippingRequested`, `urnsRequested`, `instructions`, `certificateNumber`, `completedAt`, `notes`
- Controller: `AftercarePlanController.update`

### DELETE /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `AftercarePlanController.delete`
- Response: `204`: no content
