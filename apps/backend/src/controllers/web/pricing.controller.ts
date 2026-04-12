import { Request, Response } from "express";

import { getPricingResponse } from "src/services/pricing.service";
import logger from "src/utils/logger";

export const PricingController = {
  /**
   * Public endpoint — no authentication. Returns the three plan cards
   * priced in the visitor's currency.
   *
   * Currency resolution order (see pricing.service.ts):
   *   1. Validated `X-Preferred-Currency` header (allowlist: USD, GBP, EUR)
   *   2. IP-based country lookup via `geoip-country`
   *   3. Default USD
   *
   * Response is cache-friendly: `Cache-Control: public, max-age=300` with
   * `Vary: X-Preferred-Currency` so CDN caches do not mix currencies.
   */
  getPricing: (req: Request, res: Response) => {
    try {
      const override = res.locals.overrideCurrency as unknown;
      const response = getPricingResponse(req, override);

      res.setHeader("Cache-Control", "public, max-age=300");
      res.append("Vary", "X-Preferred-Currency");
      return res.status(200).json(response);
    } catch (err) {
      logger.error("Error getPricing:", err);
      return res.status(500).json({
        message: "Failed to load pricing.",
      });
    }
  },
};
