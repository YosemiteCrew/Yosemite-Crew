import { Router } from "express";
import { ControlledSubstanceLogController } from "src/controllers/web/controlled-substance-log.controller";
import { requirePermission } from "src/middlewares/rbac";

const controlledSubstanceLogRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/controlled-substance-logs";

controlledSubstanceLogRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  ControlledSubstanceLogController.list,
);
controlledSubstanceLogRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.create,
);
controlledSubstanceLogRouter.get(
  `${BASE}/:logId`,
  requirePermission("appointments:view:any"),
  ControlledSubstanceLogController.get,
);
controlledSubstanceLogRouter.put(
  `${BASE}/:logId`,
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.update,
);
controlledSubstanceLogRouter.delete(
  `${BASE}/:logId`,
  requirePermission("appointments:edit:any"),
  ControlledSubstanceLogController.delete,
);

export default controlledSubstanceLogRouter;
