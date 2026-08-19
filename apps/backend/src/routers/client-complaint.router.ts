import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { clientComplaintController } from "src/controllers/web/client-complaint.controller";

export const clientComplaintRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/client-complaints";

clientComplaintRouter.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  clientComplaintController.create,
);

clientComplaintRouter.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  clientComplaintController.list,
);

clientComplaintRouter.get(
  `${base}/:complaintId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  clientComplaintController.get,
);

clientComplaintRouter.patch(
  `${base}/:complaintId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  clientComplaintController.update,
);

clientComplaintRouter.post(
  `${base}/:complaintId/notes`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  clientComplaintController.addNote,
);

clientComplaintRouter.delete(
  `${base}/:complaintId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  clientComplaintController.delete,
);
