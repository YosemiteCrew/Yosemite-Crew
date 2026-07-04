---
id: backend-api-audit-trail
title: Audit Trail API
slug: /apps/backend/api/audit-trail
---

Read-only endpoints for retrieving the audit trail (the history of recorded actions) for a companion or an appointment. Called by the PMS (Practice Management System, the clinic-facing web app); both routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /companion/:companionId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `companionId`
- Controller: `AuditTrailController.listForCompanion`

### GET /appointment/:appointmentId

- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `appointmentId`
- Controller: `AuditTrailController.listForAppointment`
