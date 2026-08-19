import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PhysiotherapyPlanController } from "src/controllers/web/physiotherapy-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/physiotherapy-plans";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PhysiotherapyPlanController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PhysiotherapyPlanController.create,
);
router.get(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PhysiotherapyPlanController.get,
);
router.put(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PhysiotherapyPlanController.update,
);

export default router;
