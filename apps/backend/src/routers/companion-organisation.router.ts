import { Router } from "express";
import { CompanionOrganisationController } from "../controllers/app/companion-organisation.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

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

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Accept invite sent by parent
router.post(
  "/pms/accept",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.acceptInvite,
);

// Reject invite sent by parent
router.post(
  "/pms/reject",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.rejectInvite,
);

// Link companion directly from PMS
router.post(
  "/pms/:organisationId/:companionId/link",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.linkByPmsUser,
);

// List all companion links for organisation
router.get(
  "/pms/:organisationId/list",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionOrganisationController.getLinksForOrganisation,
);

export default router;
