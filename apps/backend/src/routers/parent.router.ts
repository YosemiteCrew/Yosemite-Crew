import { Router } from "express";
import { ParentController } from "../controllers/app/parent.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionController } from "src/controllers/app/companion.controller";

const router = Router();

// Routes for Mobile
router.post("/", authorizeCognitoMobile, ParentController.createParentMobile);
router.get("/:id", authorizeCognitoMobile, ParentController.getParentMobile);
router.put("/:id", authorizeCognitoMobile, ParentController.updateParentMobile);
router.delete(
  "/:id",
  authorizeCognitoMobile,
  ParentController.deleteParentMobile,
);
router.post(
  "/profile/presigned",
  authorizeCognitoMobile,
  ParentController.getProfileUploadUrl,
);
router.get(
  "/:parentId/companions",
  authorizeCognitoMobile,
  CompanionController.getCompanionsByParentId,
);

// Routes for PMS
// Mutations require organisation membership + the companions:edit capability (parents/clients
// are managed under companion permissions), mirroring the PMS companion routes. The PMS client
// always sends the x-org-id header, so withOrgPermissions resolves the acting organisation.
router.post(
  "/pms/parents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.createParentPMS,
);
router.get("/pms/parents/:id", authorizeCognito, ParentController.getParentPMS);
router.put(
  "/pms/parents/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ParentController.updateParentPMS,
);
router.get("/pms/search", authorizeCognito, ParentController.searchByName);

export default router;
