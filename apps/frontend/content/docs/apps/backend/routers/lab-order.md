---
id: backend-api-lab-order
title: Lab Order API
slug: /apps/backend/api/lab-order
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/:provider/orders

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabOrderController`

### POST /pms/organisation/:organisationId/:provider/orders

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabOrderController`

### POST /pms/organisation/:organisationId/:provider/orders/search

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabOrderController`

### GET /pms/organisation/:organisationId/:provider/tests

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabOrderController`

### POST /pms/organisation/:organisationId/:provider/tests

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabOrderController`

### GET /pms/organisation/:organisationId/:provider/ivls/devices

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabCensusController`

### GET /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabCensusController`

### DELETE /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabCensusController`

### POST /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabCensusController`

### GET /pms/organisation/:organisationId/:provider/census/:censusId

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabCensusController`

### DELETE /pms/organisation/:organisationId/:provider/census/:censusId

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabCensusController`

### GET /pms/organisation/:organisationId/:provider/census/patient/:patientId

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabCensusController`

### DELETE /pms/organisation/:organisationId/:provider/census/patient/:patientId

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabCensusController`

### POST /pms/organisation/:organisationId/:provider/census/patient

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabCensusController`

### GET /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabOrderController`

### PUT /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabOrderController`

### DELETE /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- Permission: `labs:edit:any`
- Controller: `LabOrderController`
