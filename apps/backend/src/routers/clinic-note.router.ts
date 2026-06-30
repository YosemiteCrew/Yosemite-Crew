import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { ClinicNoteController } from "src/controllers/web/clinic-note.controller";

export const clinicNoteRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinic-notes";

clinicNoteRouter
  .route(BASE)
  .post(requirePermission("companions:edit:any"), ClinicNoteController.create)
  .get(requirePermission("companions:view:any"), ClinicNoteController.list);

clinicNoteRouter
  .route(`${BASE}/:noteId`)
  .get(requirePermission("companions:view:any"), ClinicNoteController.get)
  .patch(requirePermission("companions:edit:any"), ClinicNoteController.update)
  .delete(
    requirePermission("companions:edit:any"),
    ClinicNoteController.delete,
  );

clinicNoteRouter.post(
  `${BASE}/:noteId/pin`,
  requirePermission("companions:edit:any"),
  ClinicNoteController.pin,
);

clinicNoteRouter.post(
  `${BASE}/:noteId/unpin`,
  requirePermission("companions:edit:any"),
  ClinicNoteController.unpin,
);
