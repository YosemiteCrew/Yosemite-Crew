import { Router } from "express";
import { ControlledSubstanceLogController } from "src/controllers/web/controlled-substance-log.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const controlledSubstanceLogRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/controlled-substance-logs";

controlledSubstanceLogRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ControlledSubstanceLogController.list,
);
controlledSubstanceLogRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.create,
);
controlledSubstanceLogRouter.get(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ControlledSubstanceLogController.get,
);
controlledSubstanceLogRouter.put(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.update,
);
controlledSubstanceLogRouter.delete(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.delete,
);

export default controlledSubstanceLogRouter;
