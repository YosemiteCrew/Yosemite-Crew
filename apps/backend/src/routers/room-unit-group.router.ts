import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withRoomUnitGroupOrgPermissions,
} from "src/middlewares/rbac";
import { RoomUnitGroupController } from "src/controllers/web/room-unit-group.controller";

const router = Router();

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.create,
);

router.put(
  "/:id",
  requireWebAuth,
  withRoomUnitGroupOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.update,
);

router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("room:view:any"),
  RoomUnitGroupController.list,
);

router.delete(
  "/:id",
  requireWebAuth,
  withRoomUnitGroupOrgPermissions(),
  requirePermission("room:edit:any"),
  RoomUnitGroupController.delete,
);

export default router;
