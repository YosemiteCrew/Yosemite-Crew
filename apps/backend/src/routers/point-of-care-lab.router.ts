import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { PointOfCareLabController } from "src/controllers/web/point-of-care-lab.controller";

export const pointOfCareLabRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/poc-labs";

pointOfCareLabRouter
  .route(BASE)
  .get(requirePermission("labs:view:any"), PointOfCareLabController.list)
  .post(requirePermission("labs:edit:any"), PointOfCareLabController.create);

pointOfCareLabRouter
  .route(`${BASE}/:labId`)
  .get(requirePermission("labs:view:any"), PointOfCareLabController.get)
  .patch(requirePermission("labs:edit:any"), PointOfCareLabController.update);
