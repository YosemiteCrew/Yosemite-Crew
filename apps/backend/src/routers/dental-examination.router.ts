import { Router } from "express";
import { DentalExaminationController } from "src/controllers/web/dental-examination.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const dentalExaminationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/dental-examinations";

dentalExaminationRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DentalExaminationController.list,
);
dentalExaminationRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DentalExaminationController.create,
);
dentalExaminationRouter.get(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DentalExaminationController.get,
);
dentalExaminationRouter.put(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DentalExaminationController.update,
);
dentalExaminationRouter.delete(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DentalExaminationController.delete,
);

export default dentalExaminationRouter;
