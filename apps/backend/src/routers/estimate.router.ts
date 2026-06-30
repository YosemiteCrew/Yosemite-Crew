import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { estimateController } from "src/controllers/web/estimate.controller";

export const estimateRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/estimates";

estimateRouter.post(
  base,
  requirePermission("billing:edit:any"),
  estimateController.create,
);

estimateRouter.get(
  base,
  requirePermission("billing:view:any"),
  estimateController.list,
);

estimateRouter.get(
  `${base}/:estimateId`,
  requirePermission("billing:view:any"),
  estimateController.get,
);

estimateRouter.patch(
  `${base}/:estimateId`,
  requirePermission("billing:edit:any"),
  estimateController.update,
);

estimateRouter.post(
  `${base}/:estimateId/send`,
  requirePermission("billing:edit:any"),
  estimateController.markSent,
);

estimateRouter.post(
  `${base}/:estimateId/approve`,
  requirePermission("billing:edit:any"),
  estimateController.approve,
);

estimateRouter.post(
  `${base}/:estimateId/decline`,
  requirePermission("billing:edit:any"),
  estimateController.decline,
);

estimateRouter.delete(
  `${base}/:estimateId`,
  requirePermission("billing:edit:any"),
  estimateController.delete,
);
