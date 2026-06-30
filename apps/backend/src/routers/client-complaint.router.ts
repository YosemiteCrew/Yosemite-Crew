import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { clientComplaintController } from "src/controllers/web/client-complaint.controller";

export const clientComplaintRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/client-complaints";

clientComplaintRouter.post(
  base,
  requirePermission("teams:edit:any"),
  clientComplaintController.create,
);

clientComplaintRouter.get(
  base,
  requirePermission("teams:view:any"),
  clientComplaintController.list,
);

clientComplaintRouter.get(
  `${base}/:complaintId`,
  requirePermission("teams:view:any"),
  clientComplaintController.get,
);

clientComplaintRouter.patch(
  `${base}/:complaintId`,
  requirePermission("teams:edit:any"),
  clientComplaintController.update,
);

clientComplaintRouter.post(
  `${base}/:complaintId/notes`,
  requirePermission("teams:edit:any"),
  clientComplaintController.addNote,
);

clientComplaintRouter.delete(
  `${base}/:complaintId`,
  requirePermission("teams:edit:any"),
  clientComplaintController.delete,
);
