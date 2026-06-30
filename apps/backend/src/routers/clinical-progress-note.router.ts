import { Router } from "express";
import { ClinicalProgressNoteController } from "src/controllers/web/clinical-progress-note.controller";
import { requirePermission } from "src/middlewares/rbac";

const clinicalProgressNoteRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/clinical-notes";

clinicalProgressNoteRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  ClinicalProgressNoteController.list,
);
clinicalProgressNoteRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.create,
);
clinicalProgressNoteRouter.get(
  `${BASE}/:noteId`,
  requirePermission("appointments:view:any"),
  ClinicalProgressNoteController.get,
);
clinicalProgressNoteRouter.put(
  `${BASE}/:noteId`,
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.update,
);
clinicalProgressNoteRouter.post(
  `${BASE}/:noteId/sign`,
  requirePermission("appointments:edit:any"),
  ClinicalProgressNoteController.sign,
);

export default clinicalProgressNoteRouter;
