---
id: backend-api-developer-data
title: Developer Data API
slug: /apps/backend/api/developer-data
---

API routes for the developer data feature.

**Endpoints**

### GET /organizations

- Auth: `authorizeApiKey`
- Controller: `DeveloperDataController`

### GET /usage

- Auth: `authorizeApiKey`
- Controller: `DeveloperDataController`

### GET /appointments

- Auth: `authorizeApiKey`
- Permission: `appointments:view:any`
- Controller: `DeveloperDataController`

### GET /appointments/:appointmentId

- Auth: `authorizeApiKey`
- Permission: `appointments:view:any`
- Controller: `DeveloperDataController`
