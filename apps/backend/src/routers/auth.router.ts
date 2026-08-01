import { Router } from "express";
import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import { requireAuth, getAuthService } from "@yosemite-crew/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { requireAnyAuth } from "../middlewares/auth";
import { MfaController } from "../controllers/web/mfa.controller";
import { MfaDebugController } from "../controllers/web/mfa-debug.controller";
import { isLocalDevEnvironment } from "../utils/local-dev";
import logger from "src/utils/logger";

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
    const lookupRoles = await authServiceForRouter.getUserRoles(
      session.providerUserId ?? session.appUserId,
    );
    const normalizedLookupRoles = lookupRoles.map((role) =>
      role.trim().toLowerCase(),
    );
    const resolvedRoles =
      sessionRoles.length > 0 ? sessionRoles : normalizedLookupRoles;

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
