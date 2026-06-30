import { Router } from "express";
import { NutritionAssessmentController } from "src/controllers/web/nutrition-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const nutritionAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/nutrition-assessments";

nutritionAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  NutritionAssessmentController.list,
);
nutritionAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.create,
);
nutritionAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  NutritionAssessmentController.get,
);
nutritionAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.update,
);
nutritionAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  NutritionAssessmentController.delete,
);

export default nutritionAssessmentRouter;
