import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { BloodTransfusionController } from "src/controllers/web/blood-transfusion.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/blood-transfusions";

router.get(
  base,
  requirePermission("appointments:view:any"),
  BloodTransfusionController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.record,
);
router.get(
  `${base}/:transfusionId`,
  requirePermission("appointments:view:any"),
  BloodTransfusionController.get,
);
router.post(
  `${base}/:transfusionId/reaction`,
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.reportReaction,
);
router.put(
  `${base}/:transfusionId`,
  requirePermission("appointments:edit:any"),
  BloodTransfusionController.update,
);

export default router;
