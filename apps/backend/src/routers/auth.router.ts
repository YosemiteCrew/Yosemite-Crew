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

// Provider-neutral: returns the normalized session for either product.
router.get("/me", requireAnyAuth, (req, res: Response) => {
  const session = (req as AuthenticatedRequest).authSession!;

  res.json({
    userId: session.appUserId,
    authProfile: session.authProfile,
    loginMethod: session.loginMethod,
    email: session.email,
    emailVerified: session.emailVerified,
    mfa: session.mfa,
  });
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
