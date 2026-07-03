import { Router } from "express";
import { AppointmentController } from "../controllers/web/appointment.prisma.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withAppointmentOrgPermissions,
  withOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (OWN SCOPE – no RBAC)
   ====================================================== */

router.post(
  "/mobile",
  requireMobileAuth,
  AppointmentController.createRequestedFromMobile,
);

router.get(
  "/mobile/parent",
  requireMobileAuth,
  AppointmentController.listByParent,
);

router.post(
  "/mobile/documentUpload",
  requireMobileAuth,
  AppointmentController.getDocumentUplaodURL,
);

router.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  AppointmentController.listByCompanion,
);

router.patch(
  "/mobile/:appointmentId/reschedule",
  requireMobileAuth,
  AppointmentController.rescheduleFromMobile,
);

router.patch(
  "/mobile/:appointmentId/cancel",
  requireMobileAuth,
  AppointmentController.cancelFromMobile,
);

router.patch(
  "/mobile/:appointmentId/checkin",
  requireMobileAuth,
  AppointmentController.checkInAppointment,
);

router.get(
  "/mobile/:appointmentId",
  requireMobileAuth,
  AppointmentController.getByIdMobile,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create appointment (PMS)
router.post(
  "/pms",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.createFromPms,
);

// List appointments for organisation
router.get(
  "/pms/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentController.listByOrganisation,
);

// List appointments for a companion within an organisation
router.get(
  "/pms/organisation/:organisationId/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentController.listByCompanionForOrganisation,
);

// Accept requested appointment
router.patch(
  "/pms/:organisationId/:appointmentId/accept",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.acceptRequested,
);

// Reject requested appointment
router.patch(
  "/pms/:organisationId/:appointmentId/reject",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.rejectRequested,
);

// Cancel appointment (hard cancel)
router.patch(
  "/pms/:organisationId/:appointmentId/cancel",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.cancelFromPMS,
);

// Check-in appointment
router.patch(
  "/pms/:organisationId/:appointmentId/checkin",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.checkInAppointmentForPMS,
);

router.post(
  "/pms/:organisationId/:appointmentId/admit",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.admitFromPMS,
);

// Mark appointment ready for billing
router.patch(
  "/pms/:organisationId/:appointmentId/ready-for-billing",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.markReadyForBillingForPMS,
);

router.delete(
  "/pms/:organisationId/:appointmentId/ready-for-billing",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.reverseReadyForBillingForPMS,
);

router.post(
  "/pms/:organisationId/:appointmentId/forms",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.attachFormsToAppointment,
);

// Update appointment
router.patch(
  "/pms/:organisationId/:appointmentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentController.updateFromPms,
);

// Attach forms to appointment

// Get appointment detail
router.get(
  "/pms/:organisationId/:appointmentId",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission([
    "appointments:view:any",
    "appointments:view:own", // vets can see if assigned
  ]),
  AppointmentController.getById,
);

export default router;
