import { Router } from "express";
import { BodyConditionController } from "src/controllers/web/body-condition.controller";
import { requirePermission } from "src/middlewares/rbac";

const bodyConditionRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/body-condition";

bodyConditionRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  BodyConditionController.list,
);
bodyConditionRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  BodyConditionController.record,
);
bodyConditionRouter.get(
  `${BASE}/trend`,
  requirePermission("appointments:view:any"),
  BodyConditionController.trend,
);
bodyConditionRouter.get(
  `${BASE}/:recordId`,
  requirePermission("appointments:view:any"),
  BodyConditionController.get,
);
bodyConditionRouter.delete(
  `${BASE}/:recordId`,
  requirePermission("appointments:edit:any"),
  BodyConditionController.delete,
);

export default bodyConditionRouter;
