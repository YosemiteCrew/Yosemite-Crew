import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { MARController } from "src/controllers/web/mar.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/mar-entries",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MARController.list,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.create,
);

router.get(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MARController.get,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/administer",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.administer,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/hold",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.hold,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/miss",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.markMissed,
);

export default router;
