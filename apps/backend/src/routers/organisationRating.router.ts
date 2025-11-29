import { Router } from "express";
import { OrganisationRatingController } from "src/controllers/app/organisationRating.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";
const router = Router();

router.post(
  "/:organisationId",
  authorizeCognitoMobile,
  OrganisationRatingController.rateOrganisation
)

export default router;