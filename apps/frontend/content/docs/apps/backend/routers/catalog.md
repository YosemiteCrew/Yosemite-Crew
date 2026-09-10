---
id: backend-api-catalog
title: Catalog API
slug: /apps/backend/api/catalog
---

API routes for the catalog feature.

**Endpoints**

### POST /products

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### PATCH /products/:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /products/:id

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /packages/:id

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /organisation/:organisationId

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/summary

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/services/nearby

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/bookable-slots

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/bookable-slots/calendar-prefill

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/specialities

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/specialities

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### PATCH /organisations/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### DELETE /organisations/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/specialities/:specialityId/archive

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/specialities/:specialityId/archive

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/specialities/:specialityId/restore

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /organisation/:organisationId/specialities/:specialityId

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/specialities/:specialityId/services

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/specialities/:specialityId/services

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### PATCH /organisations/:organisationId/services/:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### DELETE /organisations/:organisationId/services/:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/services/:id/archive

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/services/:id/restore

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/specialities/:specialityId/packages

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/specialities/:specialityId/packages

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### PATCH /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### DELETE /organisations/:organisationId/packages/:id

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/packages/:id/archive

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### POST /organisations/:organisationId/packages/:id/restore

- Auth: `requireWebAuth`
- Permission: `specialities:edit:any`
- Controller: `CatalogController`

### GET /organisations/:organisationId/items/search

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`

### POST /resolve

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `CatalogController`
