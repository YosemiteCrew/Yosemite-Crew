import { Router } from "express";
import { NutritionAssessmentController } from "src/controllers/web/nutrition-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const nutritionAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/nutrition-assessments";

nutritionAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NutritionAssessmentController.list,
);
nutritionAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.create,
);
nutritionAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NutritionAssessmentController.get,
);
nutritionAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.update,
);
nutritionAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.delete,
);

export default nutritionAssessmentRouter;
