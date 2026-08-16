import { Router } from "express";
import { AftercarePlanController } from "src/controllers/web/aftercare-plan.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const aftercarePlanRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/aftercare-plans";

aftercarePlanRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AftercarePlanController.list,
);
aftercarePlanRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AftercarePlanController.create,
);
aftercarePlanRouter.get(
  `${BASE}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AftercarePlanController.get,
);
aftercarePlanRouter.put(
  `${BASE}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AftercarePlanController.update,
);
aftercarePlanRouter.delete(
  `${BASE}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AftercarePlanController.delete,
);

export default aftercarePlanRouter;
