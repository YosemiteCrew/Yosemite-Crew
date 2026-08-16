import { Router } from "express";
import { OrganisationRatingController } from "src/controllers/app/organisationRating.controller";
import { requireMobileAuth } from "src/middlewares/auth";
const router = Router();

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
