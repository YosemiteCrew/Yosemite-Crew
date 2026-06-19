import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PrescriptionController } from "src/controllers/web/prescription.controller";

const router = Router();

router.post(
  "/organisations/:organisationId/:prescriptionId/$reserve",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.reserve(req, res),
);

router.post(
  "/organisations/:organisationId/:prescriptionId/$dispense",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.dispense(req, res),
);

router.post(
  "/organisations/:organisationId/:prescriptionId/$return",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.returnPrescription(req, res),
);

router.post(
  "/organisations/:organisationId/:prescriptionId/$void-dispense",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.voidDispense(req, res),
);

export default router;
