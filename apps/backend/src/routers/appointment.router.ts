import { Router } from "express";
import { AppointmentController } from "../controllers/web/appointment.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

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

// List PMS appointments — static path FIRST
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  AppointmentController.listByOrganisation,
);

// Accept & assign vet
router.patch(
  "/pms/:appointmentId/accept",
  authorizeCognito,
  AppointmentController.acceptRequested,
);

// Reject requested appointment
router.patch(
  "/pms/:appointmentId/reject",
  authorizeCognito,
  AppointmentController.rejectRequested,
);

// Hard cancel from PMS
router.patch(
  "/pms/:appointmentId/cancel",
  authorizeCognito,
  AppointmentController.cancelFromPMS,
);

// Update details (assign vet/room)
router.patch(
  "/pms/:appointmentId",
  authorizeCognito,
  AppointmentController.updateFromPms,
);

// Get appointment detail (dynamic LAST)
router.get(
  "/pms/:appointmentId",
  authorizeCognito,
  AppointmentController.getById,
);

export default router;
