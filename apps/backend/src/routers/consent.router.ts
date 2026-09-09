import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ConsentController } from "src/controllers/app/consent.controller";
import { attachSessionIfPresent } from "src/middlewares/auth";

const router = Router();

// The consent relay is reachable without a session - the banner fires on
// marketing pages before sign-in. Keep a per-IP budget so an anonymous caller
// cannot use it to hammer the SuperAdmin panel's intake. A single visitor
// decides at most a handful of times per day (banner accept/reject, plus any
// future preference page), so 60 per 15 minutes is generous while bounded.
const consentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public. The banner must work for a signed-out visitor, and the shared
// consent key never leaves the server (it is applied in the service when
// forwarding). `attachSessionIfPresent` binds the session when one is sent so
// the panel can link the decision to the verified user without a 401, and is a
// no-op in the anonymous case.
router.post(
  "/",
  consentLimiter,
  attachSessionIfPresent,
  ConsentController.reportWebDecision,
);

export default router;
