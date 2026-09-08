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
  requirePermission("controlled-drug-register:read"),
  ControlledSubstanceLogController.list,
);
controlledSubstanceLogRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("controlled-drug-register:record"),
  ControlledSubstanceLogController.create,
);
controlledSubstanceLogRouter.get(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("controlled-drug-register:read"),
  ControlledSubstanceLogController.get,
);
controlledSubstanceLogRouter.put(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("controlled-drug-register:correct"),
  ControlledSubstanceLogController.update,
);
controlledSubstanceLogRouter.delete(
  `${BASE}/:logId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("controlled-drug-register:correct"),
  ControlledSubstanceLogController.delete,
);

export default controlledSubstanceLogRouter;
