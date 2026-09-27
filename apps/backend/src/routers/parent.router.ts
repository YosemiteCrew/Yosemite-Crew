import { Router } from "express";
import { ParentController } from "../controllers/app/parent.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionController } from "src/controllers/app/companion.controller";

const router = Router();

// Routes for Mobile
router.post("/", requireMobileAuth, ParentController.createParentMobile);
router.get("/:id", requireMobileAuth, ParentController.getParentMobile);
router.put("/:id", requireMobileAuth, ParentController.updateParentMobile);
router.delete("/:id", requireMobileAuth, ParentController.deleteParentMobile);
router.post(
  "/profile/presigned",
  requireMobileAuth,
  ParentController.getProfileUploadUrl,
);
router.get(
  "/:parentId/companions",
  requireMobileAuth,
  CompanionController.getCompanionsByParentId,
);

// Routes for PMS
// Every route requires organisation membership plus the matching companion capability
// (parents/clients are managed under companion permissions), mirroring the PMS companion
// routes. The PMS client always sends the x-org-id header, so withOrgPermissions resolves
// the acting organisation, and reads and edits are limited to that organisation's clients.
router.post(
  "/pms/parents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.createParentPMS,
);
router.get(
  "/pms/parents/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  ParentController.getParentPMS,
);
router.put(
  "/pms/parents/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.updateParentPMS,
);
router.get(
  "/pms/search",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  ParentController.searchByName,
);

export default router;
