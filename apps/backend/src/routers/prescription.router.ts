import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PrescriptionController } from "src/controllers/web/prescription.controller";

const router = Router();

router.get(
  "/organisations/:organisationId/prescription-dispense-requests",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["inventory:view:any", "prescription:view:any"]),
  (req, res) => PrescriptionController.listDispenseRequests(req, res),
);

router.get(
  "/organisations/:organisationId/prescription-dispense-requests/:dispenseRequestId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["inventory:view:any", "prescription:view:any"]),
  (req, res) => PrescriptionController.getDispenseRequest(req, res),
);

router.get(
  "/organisations/:organisationId/:prescriptionId/label.pdf",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => PrescriptionController.generateLabelPdf(req, res),
);

router.post(
  "/organisations/:organisationId/:prescriptionId/labels",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => PrescriptionController.generateLabels(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$finalize`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any"]),
  (req, res) => PrescriptionController.finalize(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$reserve`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.reserve(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$approve`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.dispense(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$not-dispensed`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.notDispensed(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$dispense`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.dispense(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$return`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.returnPrescription(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$void-dispense`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.voidDispense(req, res),
);

export default router;
