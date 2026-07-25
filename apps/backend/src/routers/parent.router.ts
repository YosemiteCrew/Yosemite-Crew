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
// Mutations require organisation membership + the companions:edit capability (parents/clients
// are managed under companion permissions), mirroring the PMS companion routes. The PMS client
// always sends the x-org-id header, so withOrgPermissions resolves the acting organisation.
router.post(
  "/pms/parents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.createParentPMS,
);
router.get("/pms/parents/:id", requireWebAuth, ParentController.getParentPMS);
router.put(
  "/pms/parents/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.updateParentPMS,
);
router.get("/pms/search", requireWebAuth, ParentController.searchByName);

export default router;
