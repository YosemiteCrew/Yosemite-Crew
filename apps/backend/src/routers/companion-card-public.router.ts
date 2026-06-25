import { Router } from "express";
import rateLimit from "express-rate-limit";
import { CompanionCardController } from "src/controllers/web/companion-card.controller";

// A public, unauthenticated QR endpoint is a prime target for enumeration and
// scraping, so it gets a tighter per-IP limit than the global limiter. Tokens
// are high-entropy and resolved by hash; a uniform 404 prevents probing.
const publicCardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// No authorizeCognito / withOrgPermissions / requirePermission: this route is
// gated solely by a valid, unexpired, unrevoked token resolved in the service.
router.get(
  "/:token",
  publicCardLimiter,
  CompanionCardController.getByPublicToken,
);

export default router;
