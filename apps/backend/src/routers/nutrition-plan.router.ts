import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { NutritionPlanController } from "src/controllers/web/nutrition-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/nutrition-plans";

router.get(
  base,
  requirePermission("appointments:view:any"),
  NutritionPlanController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  NutritionPlanController.create,
);
router.get(
  `${base}/:planId`,
  requirePermission("appointments:view:any"),
  NutritionPlanController.get,
);
router.put(
  `${base}/:planId`,
  requirePermission("appointments:edit:any"),
  NutritionPlanController.update,
);

export default router;
