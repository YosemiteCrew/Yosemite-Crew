import { Router } from "express";
import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import { requireAuth, getAuthService } from "@yosemite-crew/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { requireAnyAuth } from "../middlewares/auth";
import { MfaController } from "../controllers/web/mfa.controller";
import { MfaDebugController } from "../controllers/web/mfa-debug.controller";

const router = Router();

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

    let metadata: Record<string, unknown> = {};
    try {
      metadata = await getAuthService()!.getUserMetadata(session.appUserId);
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
      role: typeof metadata.role === "string" ? metadata.role : undefined,
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
    await getAuthService()!.signOut({ req, res });
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
router.post(
  "/mfa/totp/debug/create-device",
  requireAuth(),
  (req: SessionRequest, res: Response) =>
    MfaDebugController.createTotpDevice(req, res),
);

export default router;
