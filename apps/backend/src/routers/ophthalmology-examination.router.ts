import { Router } from "express";
import { OphthalmologyExaminationController } from "src/controllers/web/ophthalmology-examination.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const ophthalmologyExaminationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/ophthalmology-examinations";

ophthalmologyExaminationRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  OphthalmologyExaminationController.list,
);
ophthalmologyExaminationRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.create,
);
ophthalmologyExaminationRouter.get(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  OphthalmologyExaminationController.get,
);
ophthalmologyExaminationRouter.put(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.update,
);
ophthalmologyExaminationRouter.delete(
  `${BASE}/:examId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OphthalmologyExaminationController.delete,
);

export default ophthalmologyExaminationRouter;
