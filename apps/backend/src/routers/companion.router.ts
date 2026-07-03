import { Router } from "express";
import { CompanionController } from "../controllers/app/companion.controller";
import { requireMobileAuth, requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post("/", requireMobileAuth, CompanionController.createCompanionMobile);

router.get("/:id", requireMobileAuth, CompanionController.getCompanionById);

router.put("/:id", requireMobileAuth, CompanionController.updateCompanion);

router.delete("/:id", requireMobileAuth, CompanionController.deleteCompanion);

router.post(
  "/profile/presigned",
  requireMobileAuth,
  CompanionController.getProfileUploadUrl,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// PMS routes that are NOT org-scoped (search)
router.get(
  "/org/search",
  requireWebAuth,
  requirePermission("companions:view:any"),
  CompanionController.searchCompanionByName,
);

// Create companion in organisation
router.post(
  "/org/:orgId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionController.createCompanionPMS,
);

// Get companion by id (PMS)
router.get("/org/:id", requireWebAuth, CompanionController.getCompanionById);

// Update companion (PMS)
router.put(
  "/org/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionController.updateCompanion,
);

// List parent companions not linked to organisation
router.get(
  "/pms/:parentId/:organisationId/list",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionController.listParentCompanionsNotInOrganisation,
);

export default router;
