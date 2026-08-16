import { Router } from "express";
import { CompanionOrganisationController } from "../controllers/app/companion-organisation.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/link",
  requireMobileAuth,
  CompanionOrganisationController.linkByParent,
);

router.post(
  "/invite",
  requireMobileAuth,
  CompanionOrganisationController.sendInvite,
);

router.post(
  "/:linkId/approve",
  requireMobileAuth,
  CompanionOrganisationController.approvePendingLink,
);

router.post(
  "/:linkId/deny",
  requireMobileAuth,
  CompanionOrganisationController.denyPendingLink,
);

router.delete(
  "/revoke/:linkId",
  requireMobileAuth,
  CompanionOrganisationController.revokeLink,
);

router.get(
  "/:patientId",
  requireMobileAuth,
  CompanionOrganisationController.getLinksForCompanionByOrganisationType,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Accept invite sent by parent
router.post(
  "/pms/accept",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.acceptInvite,
);

// Reject invite sent by parent
router.post(
  "/pms/reject",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.rejectInvite,
);

// Link companion directly from PMS
router.post(
  "/pms/:organisationId/:patientId/link",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionOrganisationController.linkByPmsUser,
);

// List all companion links for organisation
router.get(
  "/pms/:organisationId/list",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionOrganisationController.getLinksForOrganisation,
);

export default router;
