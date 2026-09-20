---
id: backend-api-clinical-artifact-fhir
title: Clinical Artifact FHIR API
slug: /apps/backend/api/clinical-artifact-fhir
---

FHIR (Fast Healthcare Interoperability Resources) surface for four clinical artifact kinds tied to an appointment or encounter: SOAP notes (`Composition`), prescriptions (`MedicationRequest`), discharge summaries (`Composition`), and vital records (`Observation`). Each mutable kind supports create, get, update, and the custom FHIR operations `$finalize`, `$reopen`, and `$amend` (prescriptions add `$cancel`); operation names are prefixed with `$` per FHIR convention. Immunizations, rabies titrations, parasite treatments, and clinical examinations are read-only here — they're captured through the pet-passport flow and signed via Documenso, so there is no create/update route for them. Request bodies are FHIR resources; only `resourceType` is strictly validated before the payload is mapped into the internal record, so extra fields pass through. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app), require organisation RBAC (role-based access control), and are rate-limited to 120 requests per 15 minutes per key. Note that several "get" and "list" operations are exposed as `POST` rather than `GET`, matching the FHIR search-by-`POST` idiom.

**Endpoints**

### POST /organisation/:organisationId/appointment/:appointmentId/soap-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listSoapNotesForAppointment`
- Response: `200`: a FHIR `Bundle` of `Composition` resources (SOAP notes)

### POST /organisation/:organisationId/encounter/:encounterId/soap-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listSoapNotesForEncounter`
- Response: `200`: a FHIR `Bundle` of `Composition` resources (SOAP notes)

### POST /organisation/:organisationId/soap-note

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: FHIR `Composition` resource
- Controller: `ClinicalArtifactFhirController.createSoapNote`
- Response: `201`: the created SOAP note as a FHIR `Composition`

### POST /organisation/:organisationId/soap-note/:soapNoteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `soapNoteId`
- Controller: `ClinicalArtifactFhirController.getSoapNote`
- Response: `200`: the SOAP note as a FHIR `Composition`

### POST /organisation/:organisationId/soap-note/:soapNoteId/$finalize

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `soapNoteId`
- Controller: `ClinicalArtifactFhirController.finalizeSoapNote`
- Response: `200`: the finalized SOAP note as a FHIR `Composition`

### POST /organisation/:organisationId/soap-note/:soapNoteId/$reopen

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `soapNoteId`
- Controller: `ClinicalArtifactFhirController.reopenSoapNote`
- Response: `200`: the reopened SOAP note as a FHIR `Composition`

### POST /organisation/:organisationId/soap-note/:soapNoteId/$amend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `soapNoteId`
- Controller: `ClinicalArtifactFhirController.amendSoapNote`
- Response: `201`: the amended (newly created) SOAP note as a FHIR `Composition`

### PATCH /organisation/:organisationId/soap-note/:soapNoteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `soapNoteId`
- Body: FHIR `Composition` resource
- Controller: `ClinicalArtifactFhirController.updateSoapNote`
- Response: `200`: the updated SOAP note as a FHIR `Composition`

### POST /organisation/:organisationId/appointment/:appointmentId/prescriptions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listPrescriptionsForAppointment`
- Response: `200`: a FHIR `Bundle` of `MedicationRequest` resources

### POST /organisation/:organisationId/encounter/:encounterId/prescriptions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listPrescriptionsForEncounter`
- Response: `200`: a FHIR `Bundle` of `MedicationRequest` resources

### POST /organisation/:organisationId/prescription

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: FHIR `MedicationRequest` resource
- Controller: `ClinicalArtifactFhirController.createPrescription`
- Response: `201`: the created prescription as a FHIR `MedicationRequest`

### POST /organisation/:organisationId/prescription/:prescriptionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.getPrescription`
- Response: `200`: the prescription as a FHIR `MedicationRequest`

### POST /organisation/:organisationId/prescription/:prescriptionId/$finalize

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.finalizePrescription`
- Response: `200`: the finalized prescription as a FHIR `MedicationRequest`

### POST /organisation/:organisationId/prescription/:prescriptionId/$cancel

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.cancelPrescription`
- Response: `200`: the cancelled prescription as a FHIR `MedicationRequest`

### POST /organisation/:organisationId/prescription/:prescriptionId/$reopen

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.reopenPrescription`
- Response: `200`: the reopened prescription as a FHIR `MedicationRequest`

### POST /organisation/:organisationId/prescription/:prescriptionId/$amend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.amendPrescription`
- Response: `201`: the amended (newly created) prescription as a FHIR `MedicationRequest`

### PATCH /organisation/:organisationId/prescription/:prescriptionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Body: FHIR `MedicationRequest` resource
- Controller: `ClinicalArtifactFhirController.updatePrescription`
- Response: `200`: the updated prescription as a FHIR `MedicationRequest`

### DELETE /organisation/:organisationId/prescription/:prescriptionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `prescriptionId`
- Controller: `ClinicalArtifactFhirController.deletePrescription`
- Response: `204`: no content

### POST /organisation/:organisationId/appointment/:appointmentId/discharge-summaries

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listDischargeSummariesForAppointment`
- Response: `200`: a FHIR `Bundle` of `Composition` resources (discharge summaries)

### POST /organisation/:organisationId/encounter/:encounterId/discharge-summaries

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listDischargeSummariesForEncounter`
- Response: `200`: a FHIR `Bundle` of `Composition` resources (discharge summaries)

### POST /organisation/:organisationId/discharge-summary

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: FHIR `Composition` resource
- Controller: `ClinicalArtifactFhirController.createDischargeSummary`
- Response: `201`: the created discharge summary as a FHIR `Composition`

### POST /organisation/:organisationId/discharge-summary/:dischargeSummaryId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeSummaryId`
- Controller: `ClinicalArtifactFhirController.getDischargeSummary`
- Response: `200`: the discharge summary as a FHIR `Composition`

### POST /organisation/:organisationId/discharge-summary/:dischargeSummaryId/$finalize

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeSummaryId`
- Controller: `ClinicalArtifactFhirController.finalizeDischargeSummary`
- Response: `200`: the finalized discharge summary as a FHIR `Composition`

### POST /organisation/:organisationId/discharge-summary/:dischargeSummaryId/$reopen

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeSummaryId`
- Controller: `ClinicalArtifactFhirController.reopenDischargeSummary`
- Response: `200`: the reopened discharge summary as a FHIR `Composition`

### POST /organisation/:organisationId/discharge-summary/:dischargeSummaryId/$amend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeSummaryId`
- Controller: `ClinicalArtifactFhirController.amendDischargeSummary`
- Response: `201`: the amended (newly created) discharge summary as a FHIR `Composition`

### PATCH /organisation/:organisationId/discharge-summary/:dischargeSummaryId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `dischargeSummaryId`
- Body: FHIR `Composition` resource
- Controller: `ClinicalArtifactFhirController.updateDischargeSummary`
- Response: `200`: the updated discharge summary as a FHIR `Composition`

### POST /organisation/:organisationId/appointment/:appointmentId/vital-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listVitalRecordsForAppointment`
- Response: `200`: a FHIR `Bundle` of `Observation` resources (vital records)

### POST /organisation/:organisationId/encounter/:encounterId/vital-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listVitalRecordsForEncounter`
- Response: `200`: a FHIR `Bundle` of `Observation` resources (vital records)

### POST /organisation/:organisationId/vital-record

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: FHIR `Observation` resource
- Controller: `ClinicalArtifactFhirController.createVitalRecord`
- Response: `201`: the created vital record as a FHIR `Observation`

### POST /organisation/:organisationId/vital-record/:vitalRecordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `vitalRecordId`
- Controller: `ClinicalArtifactFhirController.getVitalRecord`
- Response: `200`: the vital record as a FHIR `Observation`

### POST /organisation/:organisationId/vital-record/:vitalRecordId/$finalize

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `vitalRecordId`
- Controller: `ClinicalArtifactFhirController.finalizeVitalRecord`
- Response: `200`: the finalized vital record as a FHIR `Observation`

### POST /organisation/:organisationId/vital-record/:vitalRecordId/$reopen

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `vitalRecordId`
- Controller: `ClinicalArtifactFhirController.reopenVitalRecord`
- Response: `200`: the reopened vital record as a FHIR `Observation`

### POST /organisation/:organisationId/vital-record/:vitalRecordId/$amend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `vitalRecordId`
- Controller: `ClinicalArtifactFhirController.amendVitalRecord`
- Response: `201`: the amended (newly created) vital record as a FHIR `Observation`

### PATCH /organisation/:organisationId/vital-record/:vitalRecordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `vitalRecordId`
- Body: FHIR `Observation` resource
- Controller: `ClinicalArtifactFhirController.updateVitalRecord`
- Response: `200`: the updated vital record as a FHIR `Observation`

### POST /organisation/:organisationId/appointment/:appointmentId/immunizations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listImmunizationsForAppointment`
- Response: `200`: a FHIR `Bundle` of immunization records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/encounter/:encounterId/immunizations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listImmunizationsForEncounter`
- Response: `200`: a FHIR `Bundle` of immunization records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/appointment/:appointmentId/rabies-titrations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listRabiesTitrationsForAppointment`
- Response: `200`: a FHIR `Bundle` of rabies titration records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/encounter/:encounterId/rabies-titrations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listRabiesTitrationsForEncounter`
- Response: `200`: a FHIR `Bundle` of rabies titration records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/appointment/:appointmentId/parasite-treatments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listParasiteTreatmentsForAppointment`
- Response: `200`: a FHIR `Bundle` of parasite treatment records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/encounter/:encounterId/parasite-treatments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listParasiteTreatmentsForEncounter`
- Response: `200`: a FHIR `Bundle` of parasite treatment records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/appointment/:appointmentId/clinical-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `appointmentId`
- Controller: `ClinicalArtifactFhirController.listClinicalExaminationsForAppointment`
- Response: `200`: a FHIR `Bundle` of clinical examination records (read-only; captured via the pet-passport flow)

### POST /organisation/:organisationId/encounter/:encounterId/clinical-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `encounterId`
- Controller: `ClinicalArtifactFhirController.listClinicalExaminationsForEncounter`
- Response: `200`: a FHIR `Bundle` of clinical examination records (read-only; captured via the pet-passport flow)
