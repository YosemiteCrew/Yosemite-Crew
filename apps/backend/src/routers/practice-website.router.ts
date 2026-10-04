import { Router } from "express";
import { PracticeWebsiteController } from "src/controllers/web/practice-website.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.use(requireWebAuth);

// Same permission pair as the booking page: publishing the practice's own site
// is organisation administration, held by the admin-tier roles only.
router.get(
  "/:organisationId",
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  PracticeWebsiteController.getConfig,
);

router.put(
  "/:organisationId",
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  PracticeWebsiteController.saveConfig,
);

export default router;
