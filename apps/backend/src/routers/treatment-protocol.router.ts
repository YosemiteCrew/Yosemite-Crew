import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { TreatmentProtocolController } from "src/controllers/web/treatment-protocol.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/treatment-protocols",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  TreatmentProtocolController.list,
);

router.post(
  "/pms/organisation/:organisationId/treatment-protocols",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.create,
);

router.get(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  TreatmentProtocolController.get,
);

router.put(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.update,
);

router.delete(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.archive,
);

router.post(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId/steps",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.addStep,
);

router.delete(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId/steps/:stepId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.removeStep,
);

router.post(
  "/pms/organisation/:organisationId/treatment-protocols/:protocolId/apply",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  TreatmentProtocolController.apply,
);

export default router;
