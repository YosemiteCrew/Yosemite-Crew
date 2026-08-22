import { Router, Request, Response, NextFunction } from "express";
import { ActivityPubController } from "src/controllers/web/activitypub.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
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
// The management API is reached from the web settings panel. This branch
// predates the SuperTokens migration, which retired `authorizeCognito`;
// `requireWebAuth` is its replacement for browser-session routes.
// Every management route carries the full chain inline, matching
// integration.router and the route-authz invariant: auth, then the permission
// loader, then the gate. withOrgPermissions alone only proves the caller
// belongs to the organisation and grants nothing, so without the gate any role
// could read clinical referrals, replace the federation licence, approve
// followers or broadcast an emergency. Federation is an integration surface, so
// it uses the integrations permissions.

router.get(
  "/manage/actor",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.getActorSettings(req, res)),
);

router.post(
  "/manage/follow",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.follow(req, res)),
);
router.post(
  "/manage/unfollow",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.unfollow(req, res)),
);
router.post(
  "/manage/followers/approve",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.approveFollower(req, res)),
);
router.post(
  "/manage/followers/reject",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.rejectFollower(req, res)),
);
router.get(
  "/manage/followers",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.listFollowers(req, res)),
);
router.get(
  "/manage/following",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.listFollowing(req, res)),
);

router.post(
  "/manage/referrals",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.sendReferral(req, res)),
);
router.get(
  "/manage/referrals/inbound",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.listInboundReferrals(req, res)),
);
router.get(
  "/manage/referrals/outbound",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.listOutboundReferrals(req, res)),
);

router.put(
  "/manage/license-token",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.updateLicenseToken(req, res)),
);

router.put(
  "/manage/directory-listing",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.toggleDirectoryListing(req, res)),
);
router.get(
  "/manage/directory",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  h((req, res) => ActivityPubController.getDirectory(req, res)),
);
router.patch(
  "/manage/referrals/:referralId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.respondToReferral(req, res)),
);
router.put(
  "/manage/actor",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.updateActorProfile(req, res)),
);

router.post(
  "/manage/notes",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.sendNote(req, res)),
);
router.post(
  "/manage/announce",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  h((req, res) => ActivityPubController.announceEmergency(req, res)),
);

export default router;
