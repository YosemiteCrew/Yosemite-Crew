import { Router } from "express";
import { BodyConditionController } from "src/controllers/web/body-condition.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const bodyConditionRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/body-condition";

bodyConditionRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BodyConditionController.list,
);
bodyConditionRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BodyConditionController.record,
);
bodyConditionRouter.get(
  `${BASE}/trend`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BodyConditionController.trend,
);
bodyConditionRouter.get(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BodyConditionController.get,
);
bodyConditionRouter.delete(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BodyConditionController.delete,
);

export default bodyConditionRouter;
