---
id: backend-api-medical-certificate
title: Medical Certificate API
slug: /apps/backend/api/medical-certificate
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/medical-certificates

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `MedicalCertificateController`

### POST /pms/organisation/:organisationId/medical-certificates

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `MedicalCertificateController`

### GET /pms/organisation/:organisationId/medical-certificates/:certId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `MedicalCertificateController`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/issue

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `MedicalCertificateController`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/revoke

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `MedicalCertificateController`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/expire

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `MedicalCertificateController`
