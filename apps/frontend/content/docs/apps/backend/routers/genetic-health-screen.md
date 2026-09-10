---
id: backend-api-genetic-health-screen
title: Genetic Health Screen API
slug: /apps/backend/api/genetic-health-screen
---

Manages genetic and hereditary health screening records for a companion (pet) within a PMS organisation: DNA disease-panel results plus OFA (Orthopedic Foundation for Animals) orthopedic, cardiac, and eye certifications. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/genetic-health-screens

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`
- Controller: `GeneticHealthScreenController.list`

### POST /pms/organisation/:organisationId/genetic-health-screens

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `screenedAt`, `laboratoryName`, `dnaTests` (array of `{ disease, gene, result, laboratoryId }`), `ofa_hips`, `ofa_elbows`, `ofa_patellas`, `ofa_cardiac`, `ofa_eyes`, `certificateNumber`, `certificationExpiry`, `notes`
- Controller: `GeneticHealthScreenController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `screenId`
- Controller: `GeneticHealthScreenController.get`

### PUT /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `screenId`
- Body: `UpdateBodySchema`
- Body fields: `encounterId`, `laboratoryName`, `dnaTests`, `ofa_hips`, `ofa_elbows`, `ofa_patellas`, `ofa_cardiac`, `ofa_eyes`, `certificateNumber`, `certificationExpiry`, `notes` (all optional; `patientId` and `screenedAt` cannot be changed)
- Controller: `GeneticHealthScreenController.update`

### DELETE /pms/organisation/:organisationId/genetic-health-screens/:screenId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `screenId`
- Controller: `GeneticHealthScreenController.delete`
- Response: `204`: JSON
