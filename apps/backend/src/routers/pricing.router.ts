import { Router } from "express";
import rateLimit from "express-rate-limit";

import { PricingController } from "src/controllers/web/pricing.controller";
import { validateCurrencyHeader } from "src/middlewares/validateCurrencyHeader";

const router = Router();

/**
 * Dedicated per-IP limiter for the public pricing endpoint. 30 requests per
 * minute is more than enough for any legitimate visitor (the pricing page
 * makes one call per currency change) and protects against scraping and
 * abuse on top of the global 500/15min limiter in `app.ts`.
 */
const pricingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

router.get(
  "/",
  pricingRateLimiter,
  validateCurrencyHeader,
  PricingController.getPricing,
);

export default router;
