---
id: backend-api-workspace
title: Workspace API
slug: /apps/backend/api/workspace
---

Aggregates the data the PIMS (Practice Information Management System, the clinic-facing web app) clinical workspace needs to render an appointment or encounter in one call: bootstrap data, linked documents, treatment items, and the merged document packet (rendered forms, prescriptions, and consents) served either as JSON or as a combined PDF. One route also serves the mobile app's read-only copy of an encounter's document packet PDF.

**Endpoints**

### GET /mobile/encounters/:encounterId/document-packet/pdf

- Auth: `requireMobileAuth`
- Params: `encounterId`
- Controller: `WorkspaceController.getMobileEncounterDocumentPacketPdf`
- Response: `200`: PDF binary (`Content-Type: application/pdf`), `401`: keys `message`, `403`: keys `message`

### GET /organisations/:organisationId/appointments/:appointmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `WorkspaceController.getAppointmentBootstrap`

### GET /organisations/:organisationId/appointments/:appointmentId/documents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `WorkspaceController.getAppointmentDocuments`

### GET /organisations/:organisationId/encounters/:encounterId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.getEncounterBootstrap`

### GET /organisations/:organisationId/encounters/:encounterId/documents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.getEncounterDocuments`

### GET /organisations/:organisationId/encounters/:encounterId/finalization-gate

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.getEncounterFinalizationGate`

### GET /organisations/:organisationId/encounters/:encounterId/treatment-items

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.getEncounterTreatmentItems`

### POST /organisations/:organisationId/encounters/:encounterId/treatment-items

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Body fields: `appointmentId`, `productId`, `productVersion`, `productSnapshot`, `servicePackageKind`, `quantity`, `priceSnapshot`, `billingStatus`, `invoiceRowId`, `lockState`
- Controller: `WorkspaceController.createEncounterTreatmentItem`
- Response: `201`: JSON

### PATCH /organisations/:organisationId/treatment-items/:itemId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `itemId`
- Body fields: `appointmentId`, `productId`, `productVersion`, `productSnapshot`, `servicePackageKind`, `quantity`, `priceSnapshot`, `billingStatus`, `invoiceRowId`, `lockState` (all optional)
- Controller: `WorkspaceController.updateTreatmentItem`

### DELETE /organisations/:organisationId/treatment-items/:itemId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `itemId`
- Controller: `WorkspaceController.deleteTreatmentItem`
- Response: `204`: no content

### GET /organisations/:organisationId/companions/:companionId/documents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `WorkspaceController.getCompanionDocuments`

### GET /organisations/:organisationId/companions/:companionId/medical-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `companionId`
- Controller: `WorkspaceController.getCompanionMedicalRecords`

### POST /organisations/:organisationId/encounters/:encounterId/document-packet

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.createDocumentPacket`
- Response: `201`: JSON

### GET /organisations/:organisationId/encounters/:encounterId/document-packet/pdf

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requireAllPermissions`
- Params: `organisationId`, `encounterId`
- Controller: `WorkspaceController.getEncounterDocumentPacketPdf`
- Response: `200`: PDF binary (`Content-Type: application/pdf`)

### GET /organisations/:organisationId/document-packets/:packetId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `packetId`
- Controller: `WorkspaceController.getDocumentPacket`

### POST /organisations/:organisationId/document-packets/:packetId/sign

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `packetId`
- Body fields: `signerName`
- Controller: `WorkspaceController.signDocumentPacket`
- Response: `401`: keys `message`

### POST /organisations/:organisationId/document-packets/:packetId/reconcile

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `packetId`
- Controller: `WorkspaceController.reconcileDocumentPacket`
