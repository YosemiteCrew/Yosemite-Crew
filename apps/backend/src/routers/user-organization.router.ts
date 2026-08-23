import { Router } from "express";
import { UserOrganizationController } from "../controllers/web/user-organization.controller";
import { requireWebAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withPractitionerRoleOrgPermissions,
  withUserOrganizationOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

// Role mappings ARE the permission system: creating or editing one grants
// organisation access. Membership alone is therefore not enough - these routes
// need the same `teams:edit:any` right as any other team-management action, or
// a receptionist could mint themselves an OWNER mapping.
router.post(
  "/",
  requireWebAuth,
  withPractitionerRoleOrgPermissions(),
  requirePermission("teams:edit:any"),
  UserOrganizationController.upsertMapping,
);

// The caller's own mappings; scoped to the session inside the controller.
router.get(
  "/user/mapping",
  requireWebAuth,
  UserOrganizationController.listMappingsForUser,
);

router.get(
  "/org/mapping/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  UserOrganizationController.listByOrganisationId,
);

router.get(
  "/:id",
  requireWebAuth,
  withUserOrganizationOrgPermissions(),
  requirePermission("teams:view:any"),
  UserOrganizationController.getMappingById,
);

// The caller's own mappings; scoped to the session inside the controller.
router.get("/", requireWebAuth, UserOrganizationController.listMappings);

router.delete(
  "/:id",
  requireWebAuth,
  withUserOrganizationOrgPermissions(),
  requirePermission("teams:edit:any"),
  UserOrganizationController.deleteMappingById,
);

router.put(
  "/:id",
  requireWebAuth,
  withUserOrganizationOrgPermissions(),
  requirePermission("teams:edit:any"),
  UserOrganizationController.updateMappingById,
);

export default router;
