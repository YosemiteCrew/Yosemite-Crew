import { Router } from "express";
import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import { requireAuth, getAuthService } from "@yosemite-crew/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { requireAnyAuth } from "../middlewares/auth";
import { MfaController } from "../controllers/web/mfa.controller";
import { MfaDebugController } from "../controllers/web/mfa-debug.controller";
import { isLocalDevEnvironment } from "../utils/local-dev";

const router = Router();
type AuthServiceForRouter = {
  getUserRoles(appUserId: string): Promise<string[]>;
  getUserMetadata(appUserId: string): Promise<Record<string, unknown>>;
  signOut(ctx: { req: unknown; res: Response }): Promise<void>;
};

// The auth provider is env-gated in app.ts; when it is off this router must
// fail closed instead of throwing from an uninitialized SDK.
router.use((_req, res, next) => {
  if (!getAuthService()) {
    res.status(503).json({ message: "Authentication service is not enabled" });
    return;
  }
  next();
});

// Provider-neutral: returns the normalized session for either product,
// enriched with profile metadata (names, role) held by the provider.
router.get("/me", requireAnyAuth, async (req, res: Response, next) => {
  try {
    const session = (req as AuthenticatedRequest).authSession!;
    const authService = getAuthService();
    if (!authService) {
      res
        .status(503)
        .json({ message: "Authentication service is not enabled" });
      return;
    }

    const authServiceForRouter = authService as AuthServiceForRouter;
    const sessionRoles = (session.roles ?? []).map((role) =>
      role.trim().toLowerCase(),
    );
    /*
     * Roles are looked up under `appUserId` - the same key they are WRITTEN
     * under, and the same one the metadata read below uses.
     *
     * This read was the odd one out: `providerUserId` is the RECIPE user id,
     * and `setUserRole`/`removeUserRole` have only ever written under
     * `appUserId`. The two coincide for an ordinary account, so the mismatch
     * was invisible - but not for the two cases this codebase actually
     * creates:
     *
     * - A relinked legacy account. `config/auth-hooks.ts` remaps `appUserId`
     *   to the legacy id, so a role correction lands under that key while this
     *   read looked somewhere nothing was ever written. Provisioning answered
     *   200, the client cleared `pendingSignUp`, and the correction was
     *   invisible and unrepeatable.
     * - A linked account. `AccountLinking` is enabled (MultiFactorAuth needs
     *   it), so the recipe user id can differ from the primary one, and
     *   SuperTokens keys roles on the primary - which is what `appUserId`
     *   carries.
     *
     * Reading under the write's key is therefore correct or unchanged in every
     * case, never worse. Note `middlewares/super-admin.ts` still carries the
     * old expression; it is an authorisation check, and moving it would widen
     * what that check can find, so it wants its own security review rather
     * than a ride-along here.
     */
    const lookupRoles = await authServiceForRouter.getUserRoles(
      session.appUserId,
    );
    const normalizedLookupRoles = lookupRoles.map((role) =>
      role.trim().toLowerCase(),
    );
    /*
     * The role store wins over the session claim, not the other way round.
     *
     * `st-role` is a copy of the roles taken when the access token was issued;
     * the store is where a role change lands. Reading the claim first meant a
     * correction was invisible for the life of the token: provisioning could
     * move an account from `member` to `developer`, answer 200, and `/me` would
     * keep serving `member` until the token refreshed or the user signed in
     * again - so the account stayed routed to the wrong portal with nothing to
     * show the correction had happened. Role REVOCATION had the same lag, which
     * is the more serious direction.
     *
     * The lookup is not an added cost: it was already awaited above and its
     * result discarded whenever the claim was non-empty.
     *
     * The claim stays the fallback for an empty lookup, which is what a
     * provider that cannot answer looks like - degrading to the token's copy
     * beats answering with no role at all.
     */
    const resolvedRoles =
      normalizedLookupRoles.length > 0 ? normalizedLookupRoles : sessionRoles;

    let metadata: Record<string, unknown> = {};
    try {
      metadata = await authServiceForRouter.getUserMetadata(session.appUserId);
    } catch {
      // Metadata enrichment is best-effort; the session itself is the source
      // of truth for identity.
    }

    res.json({
      userId: session.appUserId,
      authProfile: session.authProfile,
      loginMethod: session.loginMethod,
      email: session.email,
      emailVerified: session.emailVerified,
      mfa: session.mfa,
      firstName:
        session.firstName ??
        (typeof metadata.first_name === "string"
          ? metadata.first_name
          : undefined),
      lastName:
        session.lastName ??
        (typeof metadata.last_name === "string"
          ? metadata.last_name
          : undefined),
      role:
        resolvedRoles.find((role: string) => role === "superadmin") ??
        resolvedRoles[0] ??
        (typeof metadata.role === "string" ? metadata.role : undefined),
    });
  } catch (err) {
    next(err);
  }
});

// Provider-neutral logout: revokes the current session server-side. Succeeds
// even for expired/absent sessions so clients can always converge to
// signed-out.
router.post("/logout", async (req, res: Response, next) => {
  try {
    const authService = getAuthService();
    if (!authService) {
      res
        .status(503)
        .json({ message: "Authentication service is not enabled" });
      return;
    }

    const authServiceForRouter = authService as AuthServiceForRouter;
    await authServiceForRouter.signOut({ req, res });
    res.status(200).json({ status: "OK" });
  } catch (err) {
    next(err);
  }
});

router.get("/mfa/status", requireAuth(), (req: SessionRequest, res: Response) =>
  MfaController.status(req, res),
);
router.post(
  "/mfa/totp/enable",
  requireAuth(),
  (req: SessionRequest, res: Response) => MfaController.enableTotp(req, res),
);
router.post(
  "/mfa/totp/disable",
  requireAuth(),
  (req: SessionRequest, res: Response) => MfaController.disableTotp(req, res),
);
// Local-development helper for creating a TOTP device without the full
// enrollment flow. Gated at registration so the route is structurally absent
// unless this process is an explicitly-flagged local run, and gated again at
// runtime by the controller's assertLocalDev. Both consult the same helper, so
// any deployed environment - including a dev or staging tier running
// NODE_ENV=development - fails closed at both layers.
if (isLocalDevEnvironment()) {
  router.post(
    "/mfa/totp/debug/create-device",
    requireAuth(),
    (req: SessionRequest, res: Response) =>
      MfaDebugController.createTotpDevice(req, res),
  );
}

export default router;
