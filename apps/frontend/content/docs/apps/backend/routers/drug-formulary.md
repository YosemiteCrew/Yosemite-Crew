---
id: backend-api-drug-formulary
title: Drug Formulary API
slug: /apps/backend/api/drug-formulary
---

Manages an organisation's drug formulary: the catalog of drugs it prescribes from, each with one or more species-specific dosage entries. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation failures return `400` with `{ error }` (a flattened Zod error); service errors return `{ error: message }` at the service's own status code.

**Endpoints**

### POST /pms/organisation/:organisationId/drug-formulary

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateFormularySchema`
- Body fields: `drugName`, `genericName`, `category` (`ANALGESIC`, `ANTIBIOTIC`, `ANTIFUNGAL`, `ANTIPARASITIC`, `CARDIOVASCULAR`, `CHEMOTHERAPY`, `CONTROLLED_SUBSTANCE`, `DERMATOLOGY`, `ENDOCRINOLOGY`, `GASTROINTESTINAL`, `IMMUNOSUPPRESSANT`, `NEUROLOGY`, `OPHTHALMIC`, `RESPIRATORY`, `SEDATION_ANESTHESIA`, `VACCINE`, `OTHER`), `manufacturer`, `concentration`, `availableUnits`, `notes`, `dosageEntries` (array of the dosage shape below)
- Controller: `drugFormularyController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/drug-formulary

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `category`, `isActive`, `search`
- Controller: `drugFormularyController.list`

### GET /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `formularyId`
- Controller: `drugFormularyController.get`

### PATCH /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `formularyId`
- Body: `UpdateFormularySchema`
- Body fields: `drugName`, `genericName`, `category`, `manufacturer`, `concentration`, `availableUnits`, `isActive`, `notes`
- Controller: `drugFormularyController.update`

### POST /pms/organisation/:organisationId/drug-formulary/:formularyId/dosages

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `formularyId`
- Body: `DosageSchema`
- Body fields: `species`, `indication`, `doseMin`, `doseMax`, `doseUnit`, `route`, `frequency`, `maxDose`, `notes`
- Controller: `drugFormularyController.addDosage`
- Response: `201`: JSON

### DELETE /pms/organisation/:organisationId/drug-formulary/:formularyId/dosages/:dosageId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `formularyId`, `dosageId`
- Controller: `drugFormularyController.removeDosage`
- Response: `204`: (no content)

### DELETE /pms/organisation/:organisationId/drug-formulary/:formularyId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `formularyId`
- Controller: `drugFormularyController.delete`
- Response: `204`: (no content)
