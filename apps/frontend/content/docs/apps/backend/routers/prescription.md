---
id: backend-api-prescription
title: Prescription API
slug: /apps/backend/api/prescription
---

Drives a PIMS (Practice Information Management System, the clinic-facing web app) prescription through its dispense lifecycle — finalizing it, reserving stock, approving/dispensing, marking it not dispensed, returning stock, or voiding a dispense — and generates its printable label. Each dispense-affecting action reads and writes both the prescription record and inventory stock, so those routes are gated by two separate `requirePermission` calls (all-of) rather than one call with an array (any-of). This is the PIMS-facing prescription router; the mobile-facing one lives at `mobile-prescription.router.ts` and is documented separately.

**Endpoints**

### GET /organisations/:organisationId/prescription-dispense-requests

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:view:any`, `inventory:view:any`)
- Params: `organisationId`
- Query: `status` (one of `PENDING`, `NOT_DISPENSED`, `DISPENSED`), `prescriptionId`
- Controller: `PrescriptionController.listDispenseRequests`

### GET /organisations/:organisationId/prescription-dispense-requests/:dispenseRequestId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:view:any`, `inventory:view:any`)
- Params: `organisationId`, `dispenseRequestId`
- Controller: `PrescriptionController.getDispenseRequest`

### GET /organisations/:organisationId/:prescriptionId/label.pdf

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (`prescription:view:any`)
- Params: `organisationId`, `prescriptionId`
- Controller: `PrescriptionController.generateLabelPdf`
- Response: `200`: PDF (`Content-Type: application/pdf`, `Content-Disposition: inline; filename="prescription-label-<prescriptionId>.pdf"`), `400`: keys `message`, `404`: keys `message`, `500`: keys `message`

### POST /organisations/:organisationId/:prescriptionId/labels

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (`prescription:view:any`)
- Params: `organisationId`, `prescriptionId`
- Controller: `PrescriptionController.generateLabels`
- Response: identical to `GET .../label.pdf` above — both routes call the same label-rendering handler

### POST /organisations/:organisationId/:prescriptionId/\$finalize

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (any-of: `prescription:edit:any`, `prescription:edit:own`)
- Params: `organisationId`, `prescriptionId`
- Controller: `PrescriptionController.finalize`
- Response: `200`: FHIR `MedicationRequest` resource (via `prescriptionToMedicationRequest`)

### POST /organisations/:organisationId/:prescriptionId/\$reserve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.reserve`
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents`; `400`: keys `message`, `issues`

### POST /organisations/:organisationId/:prescriptionId/\$approve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.dispense` (same controller method as `POST .../\$dispense` below)
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents`; `400`: keys `message`, `issues`

### POST /organisations/:organisationId/:prescriptionId/\$not-dispensed

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.notDispensed`
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents` (always `[]`); `400`: keys `message`, `issues`

### POST /organisations/:organisationId/:prescriptionId/\$dispense

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.dispense` (same controller method as `POST .../\$approve` above)
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents`; `400`: keys `message`, `issues`

### POST /organisations/:organisationId/:prescriptionId/\$return

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.returnPrescription`
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents`; `400`: keys `message`, `issues`

### POST /organisations/:organisationId/:prescriptionId/\$void-dispense

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission` (all-of: `prescription:edit:any`, `inventory:edit:any`)
- Params: `organisationId`, `prescriptionId`
- Body: `actionBodySchema`
- Body fields: `metadata`, `reason` (both optional)
- Controller: `PrescriptionController.voidDispense`
- Response: `200`: keys `action`, `prescriptionId`, `prescription` (FHIR `MedicationRequest`), `inventoryEvents`; `400`: keys `message`, `issues`
