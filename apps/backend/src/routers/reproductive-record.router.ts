import { Router } from "express";
import { ReproductiveRecordController } from "src/controllers/web/reproductive-record.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const reproductiveRecordRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/reproductive-records";

reproductiveRecordRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ReproductiveRecordController.list,
);
reproductiveRecordRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReproductiveRecordController.create,
);
reproductiveRecordRouter.get(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ReproductiveRecordController.get,
);
reproductiveRecordRouter.put(
  `${BASE}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReproductiveRecordController.update,
);

export default reproductiveRecordRouter;
