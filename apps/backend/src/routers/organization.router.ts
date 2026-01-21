import { Router } from "express";
import { OrganizationController } from "../controllers/web/organization.controller";
import { SpecialityController } from "src/controllers/web/speciality.controller";
import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PUBLIC / MOBILE ROUTES (NO RBAC)
   ====================================================== */

router.post("/check", OrganizationController.checkIsPMSOrganistaion);

router.get("/getNearby", OrganizationController.getNearbyPaginated);

router.get(
  "/mobile/getNearby",
  authorizeCognitoMobile,
  OrganizationController.getNearbyPaginated,
);

router.post("/logo/presigned-url", OrganizationController.getLogoUploadUrl);

router.post(
  "/logo/presigned-url/:orgId",
  OrganizationController.getLogoUploadUrl,
);

/* ======================================================
   PMS – ORG CREATION / GLOBAL LIST
   ====================================================== */

// Onboard new organisation
router.post("/", authorizeCognito, OrganizationController.onboardBusiness);

// List all businesses (admin-level)
router.get("/", authorizeCognito, OrganizationController.getAllBusinesses);

/* ======================================================
   PMS – ORG SCOPED (RBAC ENABLED)
   ====================================================== */

// Get organisation details
router.get(
  "/:organizationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  OrganizationController.getBusinessById,
);

// Update organisation
router.put(
  "/:organizationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  OrganizationController.updateBusinessById,
);

// Delete organisation (OWNER only)
router.delete(
  "/:organizationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("org:delete"),
  OrganizationController.deleteBusinessById,
);

/* ======================================================
   SPECIALITIES
   ====================================================== */

router.get(
  "/:organizationId/specality",
  authorizeCognito,
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
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  OrganisationInviteController.createInvite,
);

// List invites
router.get(
  "/:organisationId/invites",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  OrganisationInviteController.listOrganisationInvites,
);

export default router;
