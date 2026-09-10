---
id: backend-api-episode-of-care
title: Episode Of Care API
slug: /apps/backend/api/episode-of-care
---

API routes for the episode of care feature.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CaseController`

### GET /

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CaseController`

### PATCH /:id

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CaseController`

### GET /:id

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CaseController`
