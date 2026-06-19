import { Router } from "express";
import { WorkspaceController } from "src/controllers/web/workspace.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/organisations/:organisationId/appointments/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getAppointmentBootstrap(req, res),
);

router.get(
  "/organisations/:organisationId/appointments/:appointmentId/documents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getAppointmentDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
  (req, res) => WorkspaceController.getEncounterBootstrap(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId/documents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getEncounterDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/encounters/:encounterId/treatment-items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  (req, res) => WorkspaceController.getEncounterTreatmentItems(req, res),
);

router.post(
  "/organisations/:organisationId/encounters/:encounterId/treatment-items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.createEncounterTreatmentItem(req, res),
);

router.patch(
  "/organisations/:organisationId/treatment-items/:itemId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.updateTreatmentItem(req, res),
);

router.delete(
  "/organisations/:organisationId/treatment-items/:itemId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  (req, res) => WorkspaceController.deleteTreatmentItem(req, res),
);

router.get(
  "/organisations/:organisationId/companions/:companionId/documents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getCompanionDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/companions/:companionId/medical-records",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getCompanionMedicalRecords(req, res),
);

router.post(
  "/organisations/:organisationId/encounters/:encounterId/document-packet",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  (req, res) => WorkspaceController.createDocumentPacket(req, res),
);

router.get(
  "/organisations/:organisationId/document-packets/:packetId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => WorkspaceController.getDocumentPacket(req, res),
);

router.post(
  "/organisations/:organisationId/document-packets/:packetId/sign",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  (req, res) => WorkspaceController.signDocumentPacket(req, res),
);

export default router;
