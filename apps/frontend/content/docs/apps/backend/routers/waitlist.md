---
id: backend-api-waitlist
title: Waitlist API
slug: /apps/backend/api/waitlist
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/waitlist

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `WaitlistController`

### POST /pms/organisation/:organisationId/waitlist

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WaitlistController`

### GET /pms/organisation/:organisationId/waitlist/:entryId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `WaitlistController`

### POST /pms/organisation/:organisationId/waitlist/:entryId/offer

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WaitlistController`

### POST /pms/organisation/:organisationId/waitlist/:entryId/book

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WaitlistController`

### POST /pms/organisation/:organisationId/waitlist/:entryId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WaitlistController`

### POST /pms/organisation/:organisationId/waitlist/expire-stale

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WaitlistController`
