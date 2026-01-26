import { Router } from "express";
import { CompanionController } from "../controllers/app/companion.controller";
import { authorizeCognitoMobile, authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/",
  authorizeCognitoMobile,
  CompanionController.createCompanionMobile,
);

router.get(
  "/:id",
  authorizeCognitoMobile,
  CompanionController.getCompanionById,
);

router.put("/:id", authorizeCognitoMobile, CompanionController.updateCompanion);

router.delete(
  "/:id",
  authorizeCognitoMobile,
  CompanionController.deleteCompanion,
);

router.post(
  "/profile/presigned",
  authorizeCognitoMobile,
  CompanionController.getProfileUploadUrl,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// PMS routes that are NOT org-scoped (search)
router.get(
  "/org/search",
  authorizeCognito,
  requirePermission("companions:view:any"),
  CompanionController.searchCompanionByName,
);

// Create companion in organisation
router.post(
  "/org/:orgId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionController.createCompanionPMS,
);

// Get companion by id (PMS)
router.get(
  "/org/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionController.getCompanionById,
);

// Update companion (PMS)
router.put(
  "/org/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  CompanionController.updateCompanion,
);

// List parent companions not linked to organisation
router.get(
  "/pms/:parentId/:organisationId/list",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionController.listParentCompanionsNotInOrganisation,
);

export default router;
