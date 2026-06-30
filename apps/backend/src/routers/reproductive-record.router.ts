import { Router } from "express";
import { ReproductiveRecordController } from "src/controllers/web/reproductive-record.controller";
import { requirePermission } from "src/middlewares/rbac";

const reproductiveRecordRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/reproductive-records";

reproductiveRecordRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  ReproductiveRecordController.list,
);
reproductiveRecordRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  ReproductiveRecordController.create,
);
reproductiveRecordRouter.get(
  `${BASE}/:recordId`,
  requirePermission("appointments:view:any"),
  ReproductiveRecordController.get,
);
reproductiveRecordRouter.put(
  `${BASE}/:recordId`,
  requirePermission("appointments:edit:any"),
  ReproductiveRecordController.update,
);

export default reproductiveRecordRouter;
