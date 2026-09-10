---
id: backend-api-mar
title: MAR API
slug: /apps/backend/api/mar
---

Manages MAR entries — a MAR (Medication Administration Record) is the clinical log of a patient's scheduled, given, held, and missed medication doses. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation. Creating an entry or moving it to given/held/missed is a clinical drug action, so these routes are gated on prescription permissions rather than the broader appointment permissions every role holds.

**Endpoints**

### GET /pms/organisation/:organisationId/mar-entries

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `status?`, `from?`, `to?`
- Controller: `MARController.list`

### POST /pms/organisation/:organisationId/mar-entries

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `prescriptionId?`, `medicationName`, `dose`, `route`, `scheduledAt`
- Controller: `MARController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/mar-entries/:marEntryId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `marEntryId`
- Controller: `MARController.get`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/administer

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `marEntryId`
- Body fields: `administeredAt?`, `notes?`
- Controller: `MARController.administer`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/hold

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `marEntryId`
- Body fields: `notes?`
- Controller: `MARController.hold`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/miss

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `marEntryId`
- Body fields: `notes?`
- Controller: `MARController.markMissed`
