import { Router } from "express";
import { AppointmentController } from "../controllers/web/appointment.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (OWN SCOPE – no RBAC)
   ====================================================== */

router.post(
  "/mobile",
  authorizeCognitoMobile,
  AppointmentController.createRequestedFromMobile,
);

router.get(
  "/mobile/parent",
  authorizeCognitoMobile,
  AppointmentController.listByParent,
);

router.post(
  "/mobile/documentUpload",
  authorizeCognitoMobile,
  AppointmentController.getDocumentUplaodURL,
);

router.get(
  "/mobile/companion/:companionId",
  authorizeCognitoMobile,
  AppointmentController.listByCompanion,
);

router.patch(
  "/mobile/:appointmentId/reschedule",
  authorizeCognitoMobile,
  AppointmentController.rescheduleFromMobile,
);

router.patch(
  "/mobile/:appointmentId/cancel",
  authorizeCognitoMobile,
  AppointmentController.cancelFromMobile,
);

router.patch(
  "/mobile/:appointmentId/checkin",
  authorizeCognitoMobile,
  AppointmentController.checkInAppointment,
);

router.get(
  "/mobile/:appointmentId",
  authorizeCognitoMobile,
  AppointmentController.getById,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create appointment (PMS)
router.post(
  "/pms",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.createFromPms,
);

// List appointments for organisation
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentController.listByOrganisation,
);

// List appointments for a companion within an organisation
router.get(
  "/pms/organisation/:organisationId/companion/:companionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentController.listByCompanionForOrganisation,
);

// Accept requested appointment
router.patch(
  "/pms/:organisationId/:appointmentId/accept",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.acceptRequested,
);

// Reject requested appointment
router.patch(
  "/pms/:organisationId/:appointmentId/reject",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.rejectRequested,
);

// Cancel appointment (hard cancel)
router.patch(
  "/pms/:organisationId/:appointmentId/cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.cancelFromPMS,
);

// Check-in appointment
router.patch(
  "/pms/:organisationId/:appointmentId/checkin",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.checkInAppointmentForPMS,
);

// Update appointment
router.patch(
  "/pms/:organisationId/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.updateFromPms,
);

// Get appointment detail
router.get(
  "/pms/:organisationId/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission([
    "appointments:view:any",
    "appointments:view:own", // vets can see if assigned
  ]),
  AppointmentController.getById,
);

export default router;
