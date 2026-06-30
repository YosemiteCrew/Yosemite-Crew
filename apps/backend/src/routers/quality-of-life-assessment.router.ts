import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { QualityOfLifeAssessmentController } from "src/controllers/web/quality-of-life-assessment.controller";

export const qualityOfLifeAssessmentRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/qol-assessments";

qualityOfLifeAssessmentRouter
  .route(BASE)
  .get(
    requirePermission("companions:view:any"),
    QualityOfLifeAssessmentController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    QualityOfLifeAssessmentController.create,
  );

qualityOfLifeAssessmentRouter
  .route(`${BASE}/trend`)
  .get(
    requirePermission("companions:view:any"),
    QualityOfLifeAssessmentController.trend,
  );

qualityOfLifeAssessmentRouter
  .route(`${BASE}/:assessmentId`)
  .get(
    requirePermission("companions:view:any"),
    QualityOfLifeAssessmentController.get,
  )
  .patch(
    requirePermission("companions:edit:any"),
    QualityOfLifeAssessmentController.update,
  );
