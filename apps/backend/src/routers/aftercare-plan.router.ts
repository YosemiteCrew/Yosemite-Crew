import { Router } from "express";
import { AftercarePlanController } from "src/controllers/web/aftercare-plan.controller";
import { requirePermission } from "src/middlewares/rbac";

const aftercarePlanRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/aftercare-plans";

aftercarePlanRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  AftercarePlanController.list,
);
aftercarePlanRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  AftercarePlanController.create,
);
aftercarePlanRouter.get(
  `${BASE}/:planId`,
  requirePermission("appointments:view:any"),
  AftercarePlanController.get,
);
aftercarePlanRouter.put(
  `${BASE}/:planId`,
  requirePermission("appointments:edit:any"),
  AftercarePlanController.update,
);
aftercarePlanRouter.delete(
  `${BASE}/:planId`,
  requirePermission("appointments:edit:any"),
  AftercarePlanController.delete,
);

export default aftercarePlanRouter;
