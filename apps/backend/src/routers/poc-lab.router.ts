import { Router } from "express";
import { PocLabController } from "src/controllers/web/poc-lab.controller";
import { requirePermission } from "src/middlewares/rbac";

const pocLabRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/poc-lab";

pocLabRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  PocLabController.list,
);
pocLabRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  PocLabController.create,
);
pocLabRouter.get(
  `${BASE}/:recordId`,
  requirePermission("appointments:view:any"),
  PocLabController.get,
);
pocLabRouter.put(
  `${BASE}/:recordId`,
  requirePermission("appointments:edit:any"),
  PocLabController.update,
);
pocLabRouter.delete(
  `${BASE}/:recordId`,
  requirePermission("appointments:edit:any"),
  PocLabController.delete,
);

export default pocLabRouter;
