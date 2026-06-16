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
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/soap-notes",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listSoapNotesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getSoapNote(req, res),
);

router.patch(
  "/organisation/:organisationId/soap-note/:soapNoteId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateSoapNote(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/prescriptions",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/prescriptions",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listPrescriptionsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/prescription",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createPrescription(req, res),
);

router.post(
  "/organisation/:organisationId/prescription/:prescriptionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getPrescription(req, res),
);

router.patch(
  "/organisation/:organisationId/prescription/:prescriptionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updatePrescription(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/discharge-summaries",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  dischargeSummaryLimiter,
  (req, res) =>
    ClinicalArtifactFhirController.listDischargeSummariesForAppointment(
      req,
      res,
    ),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/discharge-summaries",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listDischargeSummariesForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getDischargeSummary(req, res),
);

router.patch(
  "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateDischargeSummary(req, res),
);

router.post(
  "/organisation/:organisationId/appointment/:appointmentId/vital-records",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForAppointment(req, res),
);

router.post(
  "/organisation/:organisationId/encounter/:encounterId/vital-records",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) =>
    ClinicalArtifactFhirController.listVitalRecordsForEncounter(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.createVitalRecord(req, res),
);

router.post(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:view:any"]),
  (req, res) => ClinicalArtifactFhirController.getVitalRecord(req, res),
);

router.patch(
  "/organisation/:organisationId/vital-record/:vitalRecordId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["forms:edit:any"]),
  (req, res) => ClinicalArtifactFhirController.updateVitalRecord(req, res),
);

export default router;
