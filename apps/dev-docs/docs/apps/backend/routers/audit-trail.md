---
id: backend-api-audit-trail
title: Audit Trail API
slug: /apps/backend/api/audit-trail
---

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
