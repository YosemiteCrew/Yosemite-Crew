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
  "companion/:companionId",
  authorizeCognitoMobile,
  ParentCompanionController.getLinksForCompanion,
);
router.patch(
  "/:companionId/:targetParentId/permissions",
  authorizeCognitoMobile,
  ParentCompanionController.updatePermissions,
);
router.post(
  "/:companionId/:targetParentId/promote",
  authorizeCognitoMobile,
  ParentCompanionController.promoteToPrimary,
);
router.delete(
  "/:companionId/:coParentId",
  authorizeCognitoMobile,
  ParentCompanionController.removeCoParent,
);

export default router;
