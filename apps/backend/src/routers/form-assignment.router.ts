import { Router } from "express";
import { FormAssignmentController } from "src/controllers/web/form-assignment.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/organisations/:organisationId/appointments/:appointmentId/assignments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  (req, res) => FormAssignmentController.createForAppointment(req, res),
);

router.get(
  "/organisations/:organisationId/appointments/:appointmentId/assignments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  (req, res) => FormAssignmentController.listForAppointment(req, res),
);

router.get(
  "/organisations/:organisationId/assignments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  (req, res) => FormAssignmentController.listForOrganisation(req, res),
);

router.get(
  "/organisations/:organisationId/companions/:companionId/assignments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  (req, res) => FormAssignmentController.listForCompanion(req, res),
);

router.get(
  "/organisations/:organisationId/assignments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:view:any"),
  (req, res) => FormAssignmentController.listForOrganisation(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/assignments/:assignmentId/\$resend`,
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  (req, res) => FormAssignmentController.resend(req, res),
);

router.post(
  String.raw`/organisations/:organisationId/assignments/:assignmentId/\$cancel`,
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("forms:edit:any"),
  (req, res) => FormAssignmentController.cancel(req, res),
);

export default router;
