import { Router } from "express";
import { AppointmentController } from "../controllers/web/appointment.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// routes fo mobile

router.post(
  "/mobile",
  authorizeCognitoMobile,
  AppointmentController.createRequestedFromMobile,
);
// Reschedule requested appointment from parent (MOBILE)
router.patch(
  "/mobile/:appointmentId/reschedule",
  authorizeCognitoMobile,
  AppointmentController.rescheduleFromMobile,
);
router.post(
  "/mobile/:appointmentId/reschedule",
  authorizeCognitoMobile,
  AppointmentController.cancelFromMobile,
);
// List appointments for a parent (MOBILE)
router.get(
  "/mobile/parent",
  authorizeCognitoMobile,
  AppointmentController.listByParent,
);
// List appointments for a parent (MOBILE)
router.get(
  "/mobile/companion/:companionId",
  authorizeCognitoMobile,
  AppointmentController.listByCompanion,
);
// Get appointment detail (MOBILE)
router.get(
  "/mobile/:appointmentId",
  authorizeCognitoMobile,
  AppointmentController.getById,
);

// routes for PMS

router.post("/pms", authorizeCognito, AppointmentController.createFromPms);

// Accept & assign vet/staff for a requested appointment
router.patch(
  "/pms/:appointmentId/accept",
  authorizeCognito,
  AppointmentController.acceptRequested,
);

// Reject (cancel) requested appointment
router.patch(
  "/pms/:appointmentId/reject",
  authorizeCognito,
  AppointmentController.rejectRequested,
);

// Hard cancel appointment (with refund logic)
router.patch(
  "/pms/:appointmentId/cancel",
  authorizeCognito,
  AppointmentController.cancelFromPMS,
);

// Update appointment details (assign vet/staff/room)
router.patch(
  "/pms/:appointmentId",
  authorizeCognito,
  AppointmentController.updateFromPms,
);

// List PMS appointments (by filters: vet, org, date)
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  AppointmentController.listByOrganisation,
);

// Get appointment detail (PMS)
router.get(
  "/pms/:appointmentId",
  authorizeCognito,
  AppointmentController.getById,
);

export default router;
