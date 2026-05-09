import { Router } from "express";
import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import { requireAuth, getSessionUserId } from "@yosemite-crew/auth";
import { MfaController } from "../controllers/web/mfa.controller";
import { MfaDebugController } from "../controllers/web/mfa-debug.controller";

const router = Router();
router.get("/me", requireAuth(), (req: SessionRequest, res: Response) => {
  const userId = getSessionUserId(req);

  res.json({
    userId,
  });
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
