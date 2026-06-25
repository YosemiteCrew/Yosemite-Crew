import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionCardController } from "src/controllers/web/companion-card.controller";

const router = Router();

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/share",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.issueShareToken,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/shares",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.listTokens,
);

router.delete(
  "/pms/organisation/:organisationId/share/:tokenId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:share:any"),
  CompanionCardController.revokeToken,
);

export default router;
