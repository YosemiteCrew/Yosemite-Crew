import { Router, Request, Response, NextFunction } from "express";
import { ActivityPubController } from "src/controllers/web/activitypub.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions } from "src/middlewares/rbac";
import logger from "src/utils/logger";

const router = Router();

// Wrap async handlers so a rejected promise never hangs the request.
const h =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    fn(req, res).catch((err: unknown) => {
      logger.error("[AP] handler error", { err });
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });

const apEnabled = (_req: Request, res: Response, next: NextFunction) => {
  // Fail-closed: federation is enabled ONLY when explicitly turned on.
  if (process.env.AP_ENABLED !== "true") {
    return res
      .status(404)
      .json({ error: "Federation is disabled on this instance" });
  }
  return next();
};

router.use(apEnabled);

// ─── Public AP protocol endpoints (no auth — consumed by remote AP servers) ──
router.get(
  "/organizations/:orgId",
  h((req, res) => ActivityPubController.getActor(req, res)),
);
router.post(
  "/organizations/:orgId/inbox",
  h((req, res) => ActivityPubController.postInbox(req, res)),
);
router.get(
  "/organizations/:orgId/outbox",
  h((req, res) => ActivityPubController.getOutbox(req, res)),
);
router.get(
  "/organizations/:orgId/followers",
  h((req, res) => ActivityPubController.getFollowers(req, res)),
);
router.get(
  "/organizations/:orgId/following",
  h((req, res) => ActivityPubController.getFollowing(req, res)),
);
router.post(
  "/shared-inbox",
  h((req, res) => ActivityPubController.postSharedInbox(req, res)),
);

// ─── Authenticated management API (org-scoped) ───────────────────────────────
router.use(authorizeCognito, withOrgPermissions());

router.get(
  "/manage/actor",
  h((req, res) => ActivityPubController.getActorSettings(req, res)),
);

router.post(
  "/manage/follow",
  h((req, res) => ActivityPubController.follow(req, res)),
);
router.post(
  "/manage/unfollow",
  h((req, res) => ActivityPubController.unfollow(req, res)),
);
router.post(
  "/manage/followers/approve",
  h((req, res) => ActivityPubController.approveFollower(req, res)),
);
router.post(
  "/manage/followers/reject",
  h((req, res) => ActivityPubController.rejectFollower(req, res)),
);
router.get(
  "/manage/followers",
  h((req, res) => ActivityPubController.listFollowers(req, res)),
);
router.get(
  "/manage/following",
  h((req, res) => ActivityPubController.listFollowing(req, res)),
);

router.post(
  "/manage/referrals",
  h((req, res) => ActivityPubController.sendReferral(req, res)),
);
router.get(
  "/manage/referrals/inbound",
  h((req, res) => ActivityPubController.listInboundReferrals(req, res)),
);
router.get(
  "/manage/referrals/outbound",
  h((req, res) => ActivityPubController.listOutboundReferrals(req, res)),
);

router.put(
  "/manage/license-token",
  h((req, res) => ActivityPubController.updateLicenseToken(req, res)),
);

router.put(
  "/manage/directory-listing",
  h((req, res) => ActivityPubController.toggleDirectoryListing(req, res)),
);
router.get(
  "/manage/directory",
  h((req, res) => ActivityPubController.getDirectory(req, res)),
);
router.patch(
  "/manage/referrals/:referralId",
  h((req, res) => ActivityPubController.respondToReferral(req, res)),
);
router.put(
  "/manage/actor",
  h((req, res) => ActivityPubController.updateActorProfile(req, res)),
);

router.post(
  "/manage/notes",
  h((req, res) => ActivityPubController.sendNote(req, res)),
);
router.post(
  "/manage/announce",
  h((req, res) => ActivityPubController.announceEmergency(req, res)),
);

export default router;
