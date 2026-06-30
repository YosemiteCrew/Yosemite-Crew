import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { SurgicalProcedureController } from "src/controllers/web/surgical-procedure.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/surgical-procedures",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  SurgicalProcedureController.list,
);

router.post(
  "/pms/organisation/:organisationId/surgical-procedures",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  SurgicalProcedureController.create,
);

router.get(
  "/pms/organisation/:organisationId/surgical-procedures/:procedureId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  SurgicalProcedureController.get,
);

router.put(
  "/pms/organisation/:organisationId/surgical-procedures/:procedureId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  SurgicalProcedureController.update,
);

export default router;
