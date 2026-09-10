---
id: backend-api-healthcare-service
title: Healthcare Service API
slug: /apps/backend/api/healthcare-service
---

API routes for the healthcare service feature.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### PATCH /:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /:id

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /String

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /String

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`
