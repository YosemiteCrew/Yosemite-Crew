import { Router } from "express";
import { PocLabController } from "src/controllers/web/poc-lab.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const pocLabRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/poc-lab";

pocLabRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PocLabController.list,
);
pocLabRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PocLabController.create,
);
pocLabRouter.get(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PocLabController.get,
);
pocLabRouter.put(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PocLabController.update,
);
pocLabRouter.delete(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PocLabController.delete,
);

export default pocLabRouter;
