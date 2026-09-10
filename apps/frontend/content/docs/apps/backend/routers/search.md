---
id: backend-api-search
title: Search API
slug: /apps/backend/api/search
---

API routes for the search feature.

**Endpoints**

### GET /organisations/:organisationId/medications

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/inventory-items

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/templates

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/tasks

- Auth: `requireWebAuth`
- Permission: `tasks:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/documents

- Auth: `requireWebAuth`
- Permission: `document:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/services

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `SearchController`

### GET /organisations/:organisationId/packages

- Auth: `requireWebAuth`
- Permission: `specialities:view:any`
- Controller: `SearchController`
