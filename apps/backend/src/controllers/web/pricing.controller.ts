import { Request, Response } from "express";

import {
  buildPricingResponse,
  resolveCurrency,
} from "src/services/pricing.service";
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
   * Cache strategy:
   *   - Override/default: `public, max-age=300` — safe to CDN-cache keyed
   *     on the `Vary: X-Preferred-Currency` header.
   *   - IP-based: `private, no-store` — response varies by client IP which
   *     CDNs cannot key on, so it must not be cached.
   */
  getPricing: (req: Request, res: Response) => {
    try {
      const override = res.locals.overrideCurrency as unknown;
      const { currency, source } = resolveCurrency(req, override);
      const response = buildPricingResponse(currency);

      if (source === "ip") {
        res.setHeader("Cache-Control", "private, no-store");
      } else {
        res.setHeader("Cache-Control", "public, max-age=300");
      }
      res.append("Vary", "X-Preferred-Currency");
      return res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Error getPricing:", {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({
        message: "Failed to load pricing.",
      });
    }
  },
};
