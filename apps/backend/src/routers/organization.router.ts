import { Router } from "express";
import { OrganizationController } from "../controllers/web/organization.controller";
import { SpecialityController } from "src/controllers/web/speciality.controller";
import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CatalogController } from "src/controllers/web/catalog.controller";

const router = Router();

/* ======================================================
   PUBLIC / MOBILE ROUTES (NO RBAC)
   ====================================================== */

router.post("/check", OrganizationController.checkIsPMSOrganistaion);

router.get("/getNearby", OrganizationController.getNearbyPaginated);

router.get(
  "/mobile/getNearby",
  requireMobileAuth,
  CatalogController.getCatalogNearbyOrganisations,
);

router.post(
  "/logo/presigned-url",
  requireWebAuth,
  OrganizationController.getLogoUploadUrl,
);

router.post(
  "/logo/presigned-url/:orgId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  OrganizationController.getLogoUploadUrl,
);

/* ======================================================
   PMS – ORG CREATION / GLOBAL LIST
   ====================================================== */

// Onboard new organisation
router.post("/", requireWebAuth, OrganizationController.onboardBusiness);

// List all businesses (admin-level)
router.get("/", requireWebAuth, OrganizationController.getAllBusinesses);

/* ======================================================
   PMS – ORG SCOPED (RBAC ENABLED)
   ====================================================== */

// Get organisation details
router.get(
  "/:organizationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  OrganizationController.getBusinessById,
);

// Update organisation
router.put(
  "/:organizationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  OrganizationController.updateBusinessById,
);

// Delete organisation (OWNER only)
router.delete(
  "/:organizationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("org:delete"),
  OrganizationController.deleteBusinessById,
);

/* ======================================================
   SPECIALITIES
   ====================================================== */

router.get(
  "/:organizationId/specality",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  SpecialityController.getAllByOrganizationId,
);

/* ======================================================
   INVITES
   ====================================================== */

// Create invite
router.post(
  "/:organisationId/invites",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  OrganisationInviteController.createInvite,
);

// List invites
router.get(
  "/:organisationId/invites",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  OrganisationInviteController.listOrganisationInvites,
);

export default router;
