import { Router, Request, Response, NextFunction } from "express";
import { WellKnownController } from "src/controllers/web/activitypub.controller";
import logger from "src/utils/logger";

const router = Router();

// Wrap handlers so a rejected promise never hangs the request.
const h =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response) =>
    Promise.resolve(fn(req, res)).catch((err: unknown) => {
      logger.error("[AP] handler error", { err });
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });

const apEnabled = (_req: Request, res: Response, next: NextFunction) => {
  // Fail-closed: the federation discovery surface is off unless explicitly on.
  if (process.env.AP_ENABLED !== "true") {
    return res
      .status(404)
      .json({ error: "Federation is disabled on this instance" });
  }
  return next();
};

router.get(
  "/webfinger",
  apEnabled,
  h((req, res) => WellKnownController.webfinger(req, res)),
);
router.get(
  "/host-meta",
  // Gated like /webfinger. host-meta advertises the webfinger template, so
  // leaving it open told the world this was a federating instance even with
  // AP_ENABLED off, which is the opposite of failing closed.
  apEnabled,
  h((req, res) => WellKnownController.hostMeta(req, res)),
);

export default router;
