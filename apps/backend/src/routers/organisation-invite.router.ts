import { Router } from "express";

import { OrganisationInviteController } from "../controllers/web/organisation-invite.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.post(
  "/:token/accept",
  authorizeCognito,
  OrganisationInviteController.acceptInvite,
);
router.post(
  "/:token/decline",
  authorizeCognito,
  OrganisationInviteController.rejectInvite,
);
router.get(
  "/me/pending",
  authorizeCognito,
  OrganisationInviteController.listMyPendingInvites,
);

export default router;
