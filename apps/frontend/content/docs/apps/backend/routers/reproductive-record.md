---
id: backend-api-reproductive-record
title: Reproductive Record API
slug: /apps/backend/api/reproductive-record
---

Tracks a patient's reproductive status and breeding history in the PIMS (Practice Information Management System, the clinic-facing web app) — spay/neuter status (`INTACT`, `SPAYED`, `NEUTERED`, `CASTRATED`, `UNKNOWN`), heat and mating dates, sire details, pregnancy status (`SUSPECTED`, `CONFIRMED`, `WHELPED`, `QUEENED`, `ABORTED`, `RESORBED`), expected/actual whelping (birth) dates, and litter sizes from ultrasound, X-ray, and at birth. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/reproductive-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `reproductiveStatus`
- Controller: `ReproductiveRecordController.list`

### POST /pms/organisation/:organisationId/reproductive-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `reproductiveStatus`, `lastHeatDate`, `nextHeatExpected`, `matingDate`, `sireId`, `sireName`, `pregnancyStatus`, `pregnancyConfirmedAt`, `expectedWhelp`, `litterSizeUltrasound`, `litterSizeXray`, `actualWhelp`, `litterSizeBorn`, `litterSizeAlive`, `notes` (`patientId` and `reproductiveStatus` are required, the rest optional)
- Controller: `ReproductiveRecordController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/reproductive-records/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `ReproductiveRecordController.get`

### PUT /pms/organisation/:organisationId/reproductive-records/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body: `UpdateBodySchema`
- Body fields: `reproductiveStatus`, `lastHeatDate`, `nextHeatExpected`, `matingDate`, `sireId`, `sireName`, `pregnancyStatus`, `pregnancyConfirmedAt`, `expectedWhelp`, `litterSizeUltrasound`, `litterSizeXray`, `actualWhelp`, `litterSizeBorn`, `litterSizeAlive`, `notes` (all optional; `patientId` cannot be changed)
- Controller: `ReproductiveRecordController.update`
