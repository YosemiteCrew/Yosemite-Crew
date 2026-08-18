import { Router } from "express";
import { IcuCarePlanController } from "src/controllers/web/icu-care-plan.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const icuCarePlanRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/icu-care-plans";

icuCarePlanRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  IcuCarePlanController.list,
);
icuCarePlanRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.create,
);
icuCarePlanRouter.get(
  `${BASE}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  IcuCarePlanController.get,
);
icuCarePlanRouter.put(
  `${BASE}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.update,
);
icuCarePlanRouter.post(
  `${BASE}/:planId/discharge`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  IcuCarePlanController.discharge,
);

export default icuCarePlanRouter;
