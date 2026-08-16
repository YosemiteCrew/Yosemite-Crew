import { Router } from "express";
import { IsolationProtocolController } from "src/controllers/web/isolation-protocol.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

export const isolationProtocolRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/isolation-protocols";

isolationProtocolRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  IsolationProtocolController.start,
);

isolationProtocolRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  IsolationProtocolController.list,
);

isolationProtocolRouter.get(
  `${BASE}/:protocolId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  IsolationProtocolController.get,
);

isolationProtocolRouter.patch(
  `${BASE}/:protocolId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  IsolationProtocolController.update,
);

isolationProtocolRouter.post(
  `${BASE}/:protocolId/end`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  IsolationProtocolController.end,
);
