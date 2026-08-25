import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { estimateController } from "src/controllers/web/estimate.controller";

export const estimateRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/estimates";

estimateRouter.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.create,
);

estimateRouter.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  estimateController.list,
);

estimateRouter.get(
  `${base}/:estimateId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  estimateController.get,
);

estimateRouter.patch(
  `${base}/:estimateId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.update,
);

estimateRouter.post(
  `${base}/:estimateId/send`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.markSent,
);

estimateRouter.post(
  `${base}/:estimateId/approve`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.approve,
);

estimateRouter.post(
  `${base}/:estimateId/convert`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.convert,
);

estimateRouter.post(
  `${base}/:estimateId/decline`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.decline,
);

estimateRouter.delete(
  `${base}/:estimateId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  estimateController.delete,
);
