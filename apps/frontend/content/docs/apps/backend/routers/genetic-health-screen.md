---
id: backend-api-genetic-health-screen
title: Genetic Health Screen API
slug: /apps/backend/api/genetic-health-screen
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/genetic-health-screens

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `GeneticHealthScreenController`

### POST /pms/organisation/:organisationId/genetic-health-screens

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `GeneticHealthScreenController`

### GET /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `GeneticHealthScreenController`

### PUT /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `GeneticHealthScreenController`

### DELETE /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `GeneticHealthScreenController`
