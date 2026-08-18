import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { FluidTherapyPlanController } from "src/controllers/web/fluid-therapy-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/fluid-therapy-plans";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  FluidTherapyPlanController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  FluidTherapyPlanController.create,
);
router.get(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  FluidTherapyPlanController.get,
);
router.put(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  FluidTherapyPlanController.update,
);

export default router;
