import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { NutritionPlanController } from "src/controllers/web/nutrition-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/nutrition-plans";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NutritionPlanController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NutritionPlanController.create,
);
router.get(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NutritionPlanController.get,
);
router.put(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NutritionPlanController.update,
);

export default router;
