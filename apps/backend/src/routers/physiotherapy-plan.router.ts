import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { PhysiotherapyPlanController } from "src/controllers/web/physiotherapy-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/physiotherapy-plans";

router.get(
  base,
  requirePermission("appointments:view:any"),
  PhysiotherapyPlanController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  PhysiotherapyPlanController.create,
);
router.get(
  `${base}/:planId`,
  requirePermission("appointments:view:any"),
  PhysiotherapyPlanController.get,
);
router.put(
  `${base}/:planId`,
  requirePermission("appointments:edit:any"),
  PhysiotherapyPlanController.update,
);

export default router;
