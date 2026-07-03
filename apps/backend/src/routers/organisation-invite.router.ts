import { Router } from "express";

import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { requireWebAuth } from "src/middlewares/auth";

const router = Router();

router.post(
  "/:token/accept",
  requireWebAuth,
  OrganisationInviteController.acceptInvite,
);
router.post(
  "/:token/decline",
  requireWebAuth,
  OrganisationInviteController.rejectInvite,
);
router.get(
  "/me/pending",
  requireWebAuth,
  OrganisationInviteController.listMyPendingInvites,
);

export default router;
