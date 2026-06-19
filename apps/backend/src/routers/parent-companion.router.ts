import { Router } from "express";
import { ParentCompanionController } from "src/controllers/app/parent-companion.controller";
import { authorizeCognitoMobile } from "../middlewares/auth"; // for parents

export const router = Router();

router.get(
  "/parent/:parentId",
  authorizeCognitoMobile,
  ParentCompanionController.getLinksForParent,
);
router.get(
  "/companion/:patientId",
  authorizeCognitoMobile,
  ParentCompanionController.getLinksForCompanion,
);
router.patch(
  "/:patientId/:targetParentId/permissions",
  authorizeCognitoMobile,
  ParentCompanionController.updatePermissions,
);
router.post(
  "/:patientId/:targetParentId/promote",
  authorizeCognitoMobile,
  ParentCompanionController.promoteToPrimary,
);
router.delete(
  "/:patientId/:coParentId",
  authorizeCognitoMobile,
  ParentCompanionController.removeCoParent,
);

export default router;
