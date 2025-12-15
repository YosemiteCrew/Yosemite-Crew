import { Router } from "express";
import { AppointmentController } from "../controllers/web/appointment.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

// MOBILE ROUTES

// Create appointment (mobile)
router.post(
  "/mobile",
  authorizeCognitoMobile,
  AppointmentController.createRequestedFromMobile,
);

// List appointments for a parent (static route)
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

// List appointments for a companion (semi-static)
router.get(
  "/mobile/companion/:companionId",
  authorizeCognitoMobile,
  AppointmentController.listByCompanion,
);

// Reschedule appointment (mobile)
router.patch(
  "/mobile/:appointmentId/reschedule",
  authorizeCognitoMobile,
  AppointmentController.rescheduleFromMobile,
);

// Cancel appointment (mobile) — FIXED PATH
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

// Get appointment detail (mobile) — dynamic LAST
router.get(
  "/mobile/:appointmentId",
  authorizeCognitoMobile,
  AppointmentController.getById,
);

// PMS ROUTES

router.post("/pms", authorizeCognito, AppointmentController.createFromPms);

// Create appointment (PMS)
router.post(
  "/pms",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.createFromPms,
);

// List PMS appointments
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentController.listByOrganisation,
);

// Accept requested appointment
router.patch(
  "/pms/:organisationId/:appointmentId/accept",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.acceptRequested,
);

// Reject appointment
router.patch(
  "/pms/:organisationId/:appointmentId/reject",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.rejectRequested,
);

// Hard cancel (PMS)
router.patch(
  "/pms/:organisationId/:appointmentId/cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.cancelFromPMS,
);

router.patch(
  "/pms/:organisationId/:appointmentId/checkin",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.checkInAppointmentForPMS
)

// Update appointment details
router.patch(
  "/pms/:organisationId/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.updateFromPms,
);

// Get appointment detail (PMS)
router.get(
  "/pms/:organisationId/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission([
    "appointments:view:any",
    "appointments:view:own", // Vet with OWN-only can still access if assigned
  ]),
  AppointmentController.getById,
);

export default router;
