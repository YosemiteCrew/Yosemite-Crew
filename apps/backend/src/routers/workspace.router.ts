import { Router } from "express";
import { WorkspaceController } from "src/controllers/web/workspace.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  requireAllPermissions,
  withOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

router.get(
  "/mobile/encounters/:encounterId/document-packet/pdf",
  requireMobileAuth,
  (req, res) =>
    WorkspaceController.getMobileEncounterDocumentPacketPdf(req, res),
);

router.get(
  "/organisations/:organisationId/appointments/:appointmentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getAppointmentBootstrap(req, res),
);

router.get(
  "/organisations/:organisationId/appointments/:appointmentId/documents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getAppointmentDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getEncounterBootstrap(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId/documents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getEncounterDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId/finalization-gate",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getEncounterFinalizationGate(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId/treatment-items",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  (req, res) => WorkspaceController.getEncounterTreatmentItems(req, res),
);

router.post(
  "/organisations/:organisationId/encounters/:encounterId/treatment-items",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.createEncounterTreatmentItem(req, res),
);

router.patch(
  "/organisations/:organisationId/treatment-items/:itemId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.updateTreatmentItem(req, res),
);

router.delete(
  "/organisations/:organisationId/treatment-items/:itemId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.deleteTreatmentItem(req, res),
);

router.get(
  "/organisations/:organisationId/companions/:companionId/documents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getCompanionDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/companions/:companionId/medical-records",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getCompanionMedicalRecords(req, res),
);

router.post(
  "/organisations/:organisationId/encounters/:encounterId/document-packet",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  (req, res) => WorkspaceController.createDocumentPacket(req, res),
);

// ALL of these, not any: the packet merges rendered forms and prescriptions
// into one PDF, so `document:view:any` on its own would hand the aggregate to a
// caller whose form or prescription visibility had been revoked individually.
// Roles grant all three together, but `revokedPermissions` is per-user and
// overrides the role.
router.get(
  "/organisations/:organisationId/encounters/:encounterId/document-packet/pdf",
  requireWebAuth,
  withOrgPermissions(),
  requireAllPermissions([
    "document:view:any",
    "forms:view:any",
    "prescription:view:any",
  ]),
  (req, res) => WorkspaceController.getEncounterDocumentPacketPdf(req, res),
);

router.get(
  "/organisations/:organisationId/document-packets/:packetId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getDocumentPacket(req, res),
);

router.post(
  "/organisations/:organisationId/document-packets/:packetId/sign",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  (req, res) => WorkspaceController.signDocumentPacket(req, res),
);

router.post(
  "/organisations/:organisationId/document-packets/:packetId/reconcile",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  (req, res) => WorkspaceController.reconcileDocumentPacket(req, res),
);

export default router;
