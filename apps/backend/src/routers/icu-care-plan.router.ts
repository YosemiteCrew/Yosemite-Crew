import { Router } from "express";
import { IcuCarePlanController } from "src/controllers/web/icu-care-plan.controller";
import { requirePermission } from "src/middlewares/rbac";

const icuCarePlanRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/icu-care-plans";

icuCarePlanRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  IcuCarePlanController.list,
);
icuCarePlanRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.create,
);
icuCarePlanRouter.get(
  `${BASE}/:planId`,
  requirePermission("appointments:view:any"),
  IcuCarePlanController.get,
);
icuCarePlanRouter.put(
  `${BASE}/:planId`,
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.update,
);
icuCarePlanRouter.post(
  `${BASE}/:planId/discharge`,
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.discharge,
);

export default icuCarePlanRouter;
