import { Router, Request, Response, NextFunction } from "express";
import { ActivityPubController } from "src/controllers/web/activitypub.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

const apEnabled = (_req: Request, res: Response, next: NextFunction) => {
  if (process.env.AP_ENABLED === "false") {
    return res
      .status(404)
      .json({ error: "Federation is disabled on this instance" });
  }
  return next();
};

router.use(apEnabled);

// ─── Public AP protocol endpoints (no auth — consumed by remote AP servers) ──
router.get("/organizations/:orgId", (req, res) =>
  ActivityPubController.getActor(req, res),
);
router.post("/organizations/:orgId/inbox", (req, res) =>
  ActivityPubController.postInbox(req, res),
);
router.get("/organizations/:orgId/outbox", (req, res) =>
  ActivityPubController.getOutbox(req, res),
);
router.get("/organizations/:orgId/followers", (req, res) =>
  ActivityPubController.getFollowers(req, res),
);
router.get("/organizations/:orgId/following", (req, res) =>
  ActivityPubController.getFollowing(req, res),
);
router.post("/shared-inbox", (req, res) =>
  ActivityPubController.postSharedInbox(req, res),
);

// ─── Authenticated management API (org-scoped) ───────────────────────────────
router.use(authorizeCognito, withOrgPermissions());

router.get("/manage/actor", (req, res) =>
  ActivityPubController.getActorSettings(req, res),
);

router.post("/manage/follow", (req, res) =>
  ActivityPubController.follow(req, res),
);
router.post("/manage/unfollow", (req, res) =>
  ActivityPubController.unfollow(req, res),
);
router.post("/manage/followers/approve", (req, res) =>
  ActivityPubController.approveFollower(req, res),
);
router.post("/manage/followers/reject", (req, res) =>
  ActivityPubController.rejectFollower(req, res),
);
router.get("/manage/followers", (req, res) =>
  ActivityPubController.listFollowers(req, res),
);
router.get("/manage/following", (req, res) =>
  ActivityPubController.listFollowing(req, res),
);

router.post("/manage/referrals", (req, res) =>
  ActivityPubController.sendReferral(req, res),
);
router.get("/manage/referrals/inbound", (req, res) =>
  ActivityPubController.listInboundReferrals(req, res),
);
router.get("/manage/referrals/outbound", (req, res) =>
  ActivityPubController.listOutboundReferrals(req, res),
);

router.put("/manage/license-token", (req, res) =>
  ActivityPubController.updateLicenseToken(req, res),
);
router.patch("/manage/referrals/:referralId", (req, res) =>
  ActivityPubController.respondToReferral(req, res),
);
router.put("/manage/actor", (req, res) =>
  ActivityPubController.updateActorProfile(req, res),
);

router.post("/manage/notes", (req, res) =>
  ActivityPubController.sendNote(req, res),
);
router.post("/manage/announce", (req, res) =>
  ActivityPubController.announceEmergency(req, res),
);

export default router;
