---
id: backend-api-super-admin
title: Super Admin API
slug: /apps/backend/api/super-admin
---

API routes for the super admin feature.

**Endpoints**

### GET /businesses

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminBusinessController`

### GET /businesses/:id

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminBusinessController`

### PATCH /businesses/:id

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminBusinessController`

### GET /businesses/:id/members

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminBusinessController`

### GET /lab-ingestion/quarantine

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminLabIngestionController`

### PATCH /lab-ingestion/quarantine/:id/resolve

- Auth: `requireAnyAuth, requireSuperAdmin`
- Controller: `SuperAdminLabIngestionController`
