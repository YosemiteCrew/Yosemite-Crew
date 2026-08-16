import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { BloodTransfusionController } from "src/controllers/web/blood-transfusion.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/blood-transfusions";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodTransfusionController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.record,
);
router.get(
  `${base}/:transfusionId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodTransfusionController.get,
);
router.post(
  `${base}/:transfusionId/reaction`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.reportReaction,
);
router.put(
  `${base}/:transfusionId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.update,
);

export default router;
