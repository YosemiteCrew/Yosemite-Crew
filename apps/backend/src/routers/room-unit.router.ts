import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { RoomUnitController } from "src/controllers/web/room-unit.controller";

const router = Router();

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.create,
);

router.put(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.update,
);

router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  RoomUnitController.list,
);

router.delete(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitController.delete,
);

export default router;
