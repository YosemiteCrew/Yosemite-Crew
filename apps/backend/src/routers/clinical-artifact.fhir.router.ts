import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ClinicalArtifactFhirController } from "src/controllers/web/clinical-artifact.fhir.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

const dischargeSummaryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const orgId =
      (req.params.organisationId as string | undefined) ??
      (req.headers["x-org-id"] as string | undefined) ??
      "unknown-org";
    const userId = (req as { userId?: string }).userId ?? "unknown-user";
    return `${orgId}:${userId}`;
  },
});

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/soap-notes",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/soap-notes",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getSoapNote(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$finalize`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizeSoapNote(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$reopen`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenSoapNote(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$amend`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendSoapNote(req, res),
);

router.patch(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/prescriptions",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/prescriptions",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/prescription",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createPrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getPrescription(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$finalize`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizePrescription(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$cancel`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.cancelPrescription(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$reopen`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenPrescription(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$amend`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendPrescription(req, res),
);

router.patch(
  "/organisation/:organisationId/prescription/:prescriptionId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updatePrescription(req, res),
);

router.delete(
  "/organisation/:organisationId/prescription/:prescriptionId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.deletePrescription(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/discharge-summaries",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listDischargeSummariesForAppointment(
      req,
      res,
    ),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/discharge-summaries",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listDischargeSummariesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getDischargeSummary(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$finalize`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.finalizeDischargeSummary(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$reopen`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenDischargeSummary(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$amend`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendDischargeSummary(req, res),
);

router.patch(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/vital-records",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/vital-records",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getVitalRecord(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$finalize`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizeVitalRecord(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$reopen`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenVitalRecord(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$amend`,
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendVitalRecord(req, res),
);

router.patch(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  requireWebAuth,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateVitalRecord(req, res),
);

export default router;
