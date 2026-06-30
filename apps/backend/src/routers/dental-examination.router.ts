import { Router } from "express";
import { DentalExaminationController } from "src/controllers/web/dental-examination.controller";
import { requirePermission } from "src/middlewares/rbac";

const dentalExaminationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/dental-examinations";

dentalExaminationRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  DentalExaminationController.list,
);
dentalExaminationRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  DentalExaminationController.create,
);
dentalExaminationRouter.get(
  `${BASE}/:examId`,
  requirePermission("appointments:view:any"),
  DentalExaminationController.get,
);
dentalExaminationRouter.put(
  `${BASE}/:examId`,
  requirePermission("appointments:edit:any"),
  DentalExaminationController.update,
);
dentalExaminationRouter.delete(
  `${BASE}/:examId`,
  requirePermission("appointments:edit:any"),
  DentalExaminationController.delete,
);

export default dentalExaminationRouter;
