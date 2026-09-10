---
id: backend-api-waitlist
title: Waitlist API
slug: /apps/backend/api/waitlist
---

Manages an organisation's appointment waitlist: adding a patient, offering them an open slot, booking or cancelling their entry once an appointment exists for it, and expiring entries that have gone stale. All routes are under the PIMS (Practice Information Management System, the clinic-facing web app) `/pms` namespace and require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/waitlist

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `status`, `patientId`, `appointmentType`
- Controller: `WaitlistController.list`

### POST /pms/organisation/:organisationId/waitlist

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `preferredLeadId`, `appointmentType`, `earliestDate`, `latestDate`, `notes`, `expiresAt`
- Controller: `WaitlistController.add`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/waitlist/:entryId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `entryId`
- Controller: `WaitlistController.get`

### POST /pms/organisation/:organisationId/waitlist/:entryId/offer

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `entryId`
- Controller: `WaitlistController.offer`

### POST /pms/organisation/:organisationId/waitlist/:entryId/book

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `entryId`
- Body fields: `appointmentId`
- Controller: `WaitlistController.book`

### POST /pms/organisation/:organisationId/waitlist/:entryId/cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `entryId`
- Controller: `WaitlistController.cancel`

### POST /pms/organisation/:organisationId/waitlist/expire-stale

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `WaitlistController.expireStale`
