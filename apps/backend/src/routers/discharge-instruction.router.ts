import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { DischargeInstructionController } from "src/controllers/web/discharge-instruction.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/discharge-instructions",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DischargeInstructionController.list,
);

router.post(
  "/pms/organisation/:organisationId/discharge-instructions",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DischargeInstructionController.create,
);

router.get(
  "/pms/organisation/:organisationId/discharge-instructions/:dischargeId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DischargeInstructionController.get,
);

router.put(
  "/pms/organisation/:organisationId/discharge-instructions/:dischargeId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DischargeInstructionController.update,
);

router.post(
  "/pms/organisation/:organisationId/discharge-instructions/:dischargeId/send",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DischargeInstructionController.send,
);

router.post(
  "/pms/organisation/:organisationId/discharge-instructions/:dischargeId/acknowledge",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DischargeInstructionController.acknowledge,
);

export default router;
