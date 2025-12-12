import { Router } from "express";
import { CompanionOrganisationController } from "../controllers/app/companion-organisation.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// Routers for Mobile
router.post(
  "/link",
  authorizeCognitoMobile,
  CompanionOrganisationController.linkByParent,
);
router.post(
  "/invite",
  authorizeCognitoMobile,
  CompanionOrganisationController.sendInvite,
);
router.post(
  "/:linkId/approve",
  authorizeCognitoMobile,
  CompanionOrganisationController.approvePendingLink,
);
router.post(
  "/:linkId/deny",
  authorizeCognitoMobile,
  CompanionOrganisationController.denyPendingLink,
);
router.delete(
  "/revoke/:linkId",
  authorizeCognitoMobile,
  CompanionOrganisationController.revokeLink,
);
router.get(
  "/:companionId",
  authorizeCognitoMobile,
  CompanionOrganisationController.getLinksForCompanionByOrganisationType,
);

// Router for PMS
router.post(
  "/pms/accept",
  authorizeCognito,
  CompanionOrganisationController.acceptInvite,
);
router.post(
  "/pms/reject",
  authorizeCognito,
  CompanionOrganisationController.rejectInvite,
);
router.post(
  "/pms/:organisationId/:companionId/link",
  authorizeCognito,
  CompanionOrganisationController.linkByPmsUser,
)
router.get(
  "/pms/:organisationId/list",
  authorizeCognito,
  CompanionOrganisationController.getLinksForOrganisation
)

export default router;
