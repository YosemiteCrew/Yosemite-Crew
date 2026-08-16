import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { ClinicNoteController } from "src/controllers/web/clinic-note.controller";

export const clinicNoteRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinic-notes";

clinicNoteRouter
  .route(BASE)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicNoteController.create,
  )
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    ClinicNoteController.list,
  );

clinicNoteRouter
  .route(`${BASE}/:noteId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    ClinicNoteController.get,
  )
  .patch(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicNoteController.update,
  )
  .delete(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicNoteController.delete,
  );

clinicNoteRouter.post(
  `${BASE}/:noteId/pin`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ClinicNoteController.pin,
);

clinicNoteRouter.post(
  `${BASE}/:noteId/unpin`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  ClinicNoteController.unpin,
);
