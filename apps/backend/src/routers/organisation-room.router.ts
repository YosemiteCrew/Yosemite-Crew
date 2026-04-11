import { Router } from "express";
import { OrganisationRoomController } from "../controllers/web/organisation-room.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create room
router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.create,
);

// Update room
router.put(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.update,
);

// List rooms by organisation
router.get(
  "/organization/:organizationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  OrganisationRoomController.getAllByOrganizationId,
);

// Delete room
router.delete(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  OrganisationRoomController.delete,
);

export default router;
