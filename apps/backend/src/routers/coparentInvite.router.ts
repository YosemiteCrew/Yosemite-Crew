import { Router } from "express";
import { CoParentInviteController } from "src/controllers/app/coparentInvite.controller";
import { requireMobileAuth } from "src/middlewares/auth";

const router = Router();

router.post("/sent", requireMobileAuth, CoParentInviteController.sendInvite);
router.post(
  "/accept",
  requireMobileAuth,
  CoParentInviteController.acceptInvite,
);
router.post("/validate", CoParentInviteController.validateInvite);
router.post("/decline", CoParentInviteController.declineInvite);
router.get(
  "/pending",
  requireMobileAuth,
  CoParentInviteController.getPendingInvites,
);

export default router;
