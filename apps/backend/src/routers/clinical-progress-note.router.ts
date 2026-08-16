import { Router } from "express";
import { ClinicalProgressNoteController } from "src/controllers/web/clinical-progress-note.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const clinicalProgressNoteRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/clinical-notes";

clinicalProgressNoteRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ClinicalProgressNoteController.list,
);
clinicalProgressNoteRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.create,
);
clinicalProgressNoteRouter.get(
  `${BASE}/:noteId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ClinicalProgressNoteController.get,
);
clinicalProgressNoteRouter.put(
  `${BASE}/:noteId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.update,
);
clinicalProgressNoteRouter.post(
  `${BASE}/:noteId/sign`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.sign,
);

export default clinicalProgressNoteRouter;
