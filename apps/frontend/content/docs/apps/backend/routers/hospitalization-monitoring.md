---
id: backend-api-hospitalization-monitoring
title: Hospitalization Monitoring API
slug: /apps/backend/api/hospitalization-monitoring
---

Records and lists periodic vital-sign and nursing observations (temperature, heart/respiratory rate, SpO2, blood pressure, pain score, intake/output, and similar) for a hospitalised patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/hospitalization-monitoring

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `admissionId`, `encounterId`, `from`, `to`
- Controller: `HospitalizationMonitoringController.list`

### POST /pms/organisation/:organisationId/hospitalization-monitoring

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordBodySchema`
- Body fields: `patientId`, `admissionId`, `encounterId`, `observedAt`, `temperature`, `temperatureUnit` (`C`|`F`), `heartRate`, `respiratoryRate`, `spo2`, `bloodPressureSystolic`, `bloodPressureDiastolic`, `etco2`, `painScore`, `crtSecs`, `mucousMembranes`, `inputMl`, `outputMl`, `mentalStatus`, `appetite`, `urination`, `defecation`, `notes`
- Controller: `HospitalizationMonitoringController.record`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/hospitalization-monitoring/:obsId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `obsId`
- Controller: `HospitalizationMonitoringController.get`

### DELETE /pms/organisation/:organisationId/hospitalization-monitoring/:obsId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `obsId`
- Controller: `HospitalizationMonitoringController.delete`
- Response: `204`: JSON
