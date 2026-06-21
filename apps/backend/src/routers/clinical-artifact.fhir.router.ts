import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ClinicalArtifactFhirController } from "src/controllers/web/clinical-artifact.fhir.controller";
import { authorizeCognito } from "src/middlewares/auth";
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
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/soap-notes",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId/$finalize",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizeSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId/$reopen",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId/$amend",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendSoapNote(req, res),
);

router.patch(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/prescriptions",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/prescriptions",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/prescription",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createPrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getPrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId/$finalize",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizePrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId/$reopen",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenPrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId/$amend",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendPrescription(req, res),
);

router.patch(
  "/organisation/:organisationId/prescription/:prescriptionId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updatePrescription(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/discharge-summaries",
  authorizeCognito,
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
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listDischargeSummariesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$finalize",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.finalizeDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$reopen",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$amend",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendDischargeSummary(req, res),
);

router.patch(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/vital-records",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/vital-records",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId/$finalize",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.finalizeVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId/$reopen",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.reopenVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId/$amend",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.amendVitalRecord(req, res),
);

router.patch(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  authorizeCognito,
  dischargeSummaryLimiter,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateVitalRecord(req, res),
);

export default router;
