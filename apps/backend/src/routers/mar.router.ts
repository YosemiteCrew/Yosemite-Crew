import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { MARController } from "src/controllers/web/mar.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/mar-entries",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MARController.list,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.create,
);

router.get(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MARController.get,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/administer",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.administer,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/hold",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.hold,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/miss",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MARController.markMissed,
);

export default router;
