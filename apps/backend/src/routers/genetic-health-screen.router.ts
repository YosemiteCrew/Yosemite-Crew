import { Router } from "express";
import { GeneticHealthScreenController } from "src/controllers/web/genetic-health-screen.controller";
import { requirePermission } from "src/middlewares/rbac";

const geneticHealthScreenRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/genetic-health-screens";

geneticHealthScreenRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  GeneticHealthScreenController.list,
);
geneticHealthScreenRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.create,
);
geneticHealthScreenRouter.get(
  `${BASE}/:screenId`,
  requirePermission("appointments:view:any"),
  GeneticHealthScreenController.get,
);
geneticHealthScreenRouter.put(
  `${BASE}/:screenId`,
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.update,
);
geneticHealthScreenRouter.delete(
  `${BASE}/:screenId`,
  requirePermission("appointments:edit:any"),
  GeneticHealthScreenController.delete,
);

export default geneticHealthScreenRouter;
