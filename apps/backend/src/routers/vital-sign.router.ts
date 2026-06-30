import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { VitalSignController } from "src/controllers/web/vital-sign.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/vital-signs",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  VitalSignController.list,
);

router.post(
  "/pms/organisation/:organisationId/vital-signs",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  VitalSignController.record,
);

router.get(
  "/pms/organisation/:organisationId/vital-signs/:vitalSignId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  VitalSignController.get,
);

router.put(
  "/pms/organisation/:organisationId/vital-signs/:vitalSignId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  VitalSignController.update,
);

router.delete(
  "/pms/organisation/:organisationId/vital-signs/:vitalSignId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  VitalSignController.delete,
);

export default router;
