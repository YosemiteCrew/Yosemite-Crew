import { Router } from "express";
import { CompanionController } from "../controllers/app/companion.controller";
import { requireMobileAuth, requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { requireCompanionPermission } from "src/middlewares/companion-access";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post("/", requireMobileAuth, CompanionController.createCompanionMobile);

router.get(
  "/:id",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "id"),
  CompanionController.getCompanionById,
);

router.put(
  "/:id",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "id"),
  CompanionController.updateCompanion,
);

router.delete("/:id", requireMobileAuth, CompanionController.deleteCompanion);

router.post(
  "/profile/presigned",
  requireMobileAuth,
  CompanionController.getProfileUploadUrl,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// `withOrgPermissions` is not optional here, for two reasons: `requirePermission`
// answers 500 when no permission set has been loaded, so this route could only
// ever error; and `Patient` rows are not org-scoped in the schema, so the search
// behind it would otherwise return every companion in the product.
router.get(
  "/org/search",
  requireWebAuth,
  withOrgPermissions(),
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
