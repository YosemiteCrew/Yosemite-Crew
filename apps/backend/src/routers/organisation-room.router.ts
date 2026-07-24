import { Router } from "express";
import { OrganisationRoomController } from "../controllers/web/organisation-room.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create room
router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.create,
);

// Update room
router.put(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.update,
);

// List rooms by organisation
router.get(
  "/organization/:organizationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  OrganisationRoomController.getAllByOrganizationId,
);

router.get(
  "/organization/:organizationId/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  OrganisationRoomController.getById,
);

router.get(
  "/organization/:organizationId/summary",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  OrganisationRoomController.getAllByOrganizationId,
);

router.patch(
  "/organization/:organizationId/:id/availability",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.toggleAvailability,
);

// Delete room
router.delete(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.delete,
);

export default router;
