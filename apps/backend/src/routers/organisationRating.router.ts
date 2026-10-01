import { Router } from "express";
import { OrganisationRatingController } from "src/controllers/app/organisationRating.controller";
import { PractitionerFeedbackController } from "src/controllers/app/practitioner-feedback.controller";
import { requireMobileAuth } from "src/middlewares/auth";
const router = Router();

router.post(
  "/practitioner-feedback",
  requireMobileAuth,
  PractitionerFeedbackController.getForAppointment,
);

router.put(
  "/appointment/:appointmentId/practitioner-feedback",
  requireMobileAuth,
  PractitionerFeedbackController.rateAppointment,
);

router.post(
  "/:organisationId",
  requireMobileAuth,
  OrganisationRatingController.rateOrganisation,
);

router.get(
  "/:organisationId/is-rated",
  requireMobileAuth,
  OrganisationRatingController.isUserRatedOrganisation,
);

export default router;
