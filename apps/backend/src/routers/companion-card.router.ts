import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionCardController } from "src/controllers/web/companion-card.controller";

const router = Router();

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/share",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.issueShareToken,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/shares",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.listTokens,
);

router.delete(
  "/pms/organisation/:organisationId/share/:tokenId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.revokeToken,
);

export default router;
