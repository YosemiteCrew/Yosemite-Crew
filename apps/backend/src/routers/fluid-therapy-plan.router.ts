import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { FluidTherapyPlanController } from "src/controllers/web/fluid-therapy-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/fluid-therapy-plans";

router.get(
  base,
  requirePermission("appointments:view:any"),
  FluidTherapyPlanController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  FluidTherapyPlanController.create,
);
router.get(
  `${base}/:planId`,
  requirePermission("appointments:view:any"),
  FluidTherapyPlanController.get,
);
router.put(
  `${base}/:planId`,
  requirePermission("appointments:edit:any"),
  FluidTherapyPlanController.update,
);

export default router;
