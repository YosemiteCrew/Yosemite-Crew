import { Router } from "express";
import { ParentCompanionController } from "src/controllers/app/parent-companion.controller";
import { requireMobileAuth } from "../middlewares/auth"; // for parents

export const router = Router();

router.get(
  "/parent/:parentId",
  requireMobileAuth,
  ParentCompanionController.getLinksForParent,
);
router.get(
  "/companion/:patientId",
  requireMobileAuth,
  ParentCompanionController.getLinksForCompanion,
);
router.patch(
  "/:patientId/:targetParentId/permissions",
  requireMobileAuth,
  ParentCompanionController.updatePermissions,
);
router.post(
  "/:patientId/:targetParentId/promote",
  requireMobileAuth,
  ParentCompanionController.promoteToPrimary,
);
router.delete(
  "/:patientId/:coParentId",
  requireMobileAuth,
  ParentCompanionController.removeCoParent,
);

export default router;
