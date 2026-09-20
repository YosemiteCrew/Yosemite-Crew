---
id: backend-api-form-assignment
title: Form Assignment API
slug: /apps/backend/api/form-assignment
---

Manages form assignments: sending a template-based form to a client for an appointment, listing assignments by appointment/companion/organisation, and resending or cancelling one. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. A body that fails Zod validation returns `400` with `{ message, issues: [{ path, message }] }`; a known service error returns `{ message }` at its own status code.

**Endpoints**

### POST /organisations/:organisationId/appointments/:appointmentId/assignments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Body: `createBodySchema` (`createFormAssignmentSchema` minus `organisationId`/`createdBy`/`appointmentId`, which come from the URL and session)
- Body fields: `templateId`, `templateVersion`, `companionId`, `mobileVisible`, `signingRequired`, `signerIdentity` (`{ userId, name, email, role }`)
- Controller: `FormAssignmentController.createForAppointment`
- Response: `201`: JSON

### GET /organisations/:organisationId/appointments/:appointmentId/assignments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `FormAssignmentController.listForAppointment`

### GET /organisations/:organisationId/assignments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `parentId`, `companionId`, `status`
- Controller: `FormAssignmentController.listForOrganisation`
- Note: this route is registered twice in the router with identical path, method, and handler; the second registration is unreachable.

### GET /organisations/:organisationId/companions/:companionId/assignments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `FormAssignmentController.listForCompanion`

### POST /organisations/:organisationId/assignments/:assignmentId/$resend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assignmentId`
- Controller: `FormAssignmentController.resend`

### POST /organisations/:organisationId/assignments/:assignmentId/$cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assignmentId`
- Controller: `FormAssignmentController.cancel`
