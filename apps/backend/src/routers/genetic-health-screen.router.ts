import { Router } from "express";
import { GeneticHealthScreenController } from "src/controllers/web/genetic-health-screen.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const geneticHealthScreenRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/genetic-health-screens";

geneticHealthScreenRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  GeneticHealthScreenController.list,
);
geneticHealthScreenRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.create,
);
geneticHealthScreenRouter.get(
  `${BASE}/:screenId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  GeneticHealthScreenController.get,
);
geneticHealthScreenRouter.put(
  `${BASE}/:screenId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.update,
);
geneticHealthScreenRouter.delete(
  `${BASE}/:screenId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.delete,
);

export default geneticHealthScreenRouter;
