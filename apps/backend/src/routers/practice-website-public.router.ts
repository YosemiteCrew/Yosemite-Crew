import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PublicSiteController } from "src/controllers/app/public-site.controller";

// Same read budget as the public booking page it sits in front of.
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.get("/:slug", publicReadLimiter, PublicSiteController.getSite);

export default router;
