import { Router } from "express";
import { IsolationProtocolController } from "src/controllers/web/isolation-protocol.controller";
import { requirePermission } from "src/middlewares/rbac";

export const isolationProtocolRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/isolation-protocols";

isolationProtocolRouter.post(
  BASE,
  requirePermission("companions:edit:any"),
  IsolationProtocolController.start,
);

isolationProtocolRouter.get(
  BASE,
  requirePermission("companions:view:any"),
  IsolationProtocolController.list,
);

isolationProtocolRouter.get(
  `${BASE}/:protocolId`,
  requirePermission("companions:view:any"),
  IsolationProtocolController.get,
);

isolationProtocolRouter.patch(
  `${BASE}/:protocolId`,
  requirePermission("companions:edit:any"),
  IsolationProtocolController.update,
);

isolationProtocolRouter.post(
  `${BASE}/:protocolId/end`,
  requirePermission("companions:edit:any"),
  IsolationProtocolController.end,
);
