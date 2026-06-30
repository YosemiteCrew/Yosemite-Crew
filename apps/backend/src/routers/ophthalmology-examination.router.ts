import { Router } from "express";
import { OphthalmologyExaminationController } from "src/controllers/web/ophthalmology-examination.controller";
import { requirePermission } from "src/middlewares/rbac";

const ophthalmologyExaminationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/ophthalmology-examinations";

ophthalmologyExaminationRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  OphthalmologyExaminationController.list,
);
ophthalmologyExaminationRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.create,
);
ophthalmologyExaminationRouter.get(
  `${BASE}/:examId`,
  requirePermission("appointments:view:any"),
  OphthalmologyExaminationController.get,
);
ophthalmologyExaminationRouter.put(
  `${BASE}/:examId`,
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.update,
);
ophthalmologyExaminationRouter.delete(
  `${BASE}/:examId`,
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.delete,
);

export default ophthalmologyExaminationRouter;
