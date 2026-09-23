import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import type { Permission } from "src/models/role-permission";
import { PrescriptionController } from "src/controllers/web/prescription.controller";
import { PrescriptionFillAuthorisationController } from "src/controllers/web/prescription-fill-authorisation.controller";

const router = Router();

/**
 * `requirePermission` treats a permission array as any-of. Dispense routes read
 * and mutate prescription records *and* stock records, so each permission is
 * checked by its own middleware to get all-of semantics.
 */
const requireAllPermissions = (
  required: Permission[],
): ReturnType<typeof requirePermission>[] =>
  required.map((permission) => requirePermission(permission));

router.get(
  "/organisations/:organisationId/prescription-dispense-requests",
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:view:any", "inventory:view:any"]),
  (req, res) => PrescriptionController.listDispenseRequests(req, res),
);

router.get(
  "/organisations/:organisationId/prescription-dispense-requests/:dispenseRequestId",
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:view:any", "inventory:view:any"]),
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
  requirePermission(["prescription:edit:any", "prescription:edit:own"]),
  (req, res) => PrescriptionController.finalize(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$reserve`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.reserve(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$approve`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.dispense(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$not-dispensed`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.notDispensed(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$dispense`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.dispense(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$return`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.returnPrescription(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/:prescriptionId/\$void-dispense`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionController.voidDispense(req, res),
);

/*
 * Authorised repeats (#3162).
 *
 * Issuing and withdrawing an authority is a prescribing decision, so it needs
 * only the prescription permissions. Allocating, fulfilling and releasing a
 * fill move stock as well, so they take the all-of pair the dispense routes
 * above already use. Reading eligibility is deliberately the looser of the
 * two: the prescriber has to see remaining repeats while writing the
 * prescription, and requiring inventory:view there would hide it from them.
 */
router.post(
  "/organisations/:organisationId/items/:itemId/fill-authorisations",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "prescription:edit:own"]),
  (req, res) => PrescriptionFillAuthorisationController.authorise(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/fill-authorisations/:authorizationId/\$revoke`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:edit:any", "prescription:edit:own"]),
  (req, res) => PrescriptionFillAuthorisationController.revoke(req, res),
);

router.get(
  "/organisations/:organisationId/items/:itemId/fill-eligibility",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["prescription:view:any"]),
  (req, res) => PrescriptionFillAuthorisationController.eligibility(req, res),
);

router.post(
  "/organisations/:organisationId/items/:itemId/fill-reservations",
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionFillAuthorisationController.reserve(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/fill-reservations/:reservationId/\$fulfil`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionFillAuthorisationController.fulfil(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/fill-reservations/:reservationId/\$cancel`,
  requireWebAuth,
  withOrgPermissions(),
  ...requireAllPermissions(["prescription:edit:any", "inventory:edit:any"]),
  (req, res) => PrescriptionFillAuthorisationController.cancel(req, res),
);

export default router;
