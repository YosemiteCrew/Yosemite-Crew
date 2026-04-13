import { NextFunction, Request, Response } from "express";

import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "src/constants/pricing.constants";
import logger from "src/utils/logger";

const HEADER_NAME = "x-preferred-currency";

/**
 * Reads `X-Preferred-Currency` from the request, validates it against the
 * allowlist, and stashes the canonical uppercase value on
 * `res.locals.overrideCurrency` for downstream handlers.
 *
 * Defense-in-depth:
 *   - Only accepts strings (ignores arrays of headers)
 *   - Case-insensitive input, always normalised to uppercase before storing
 *   - Exact `Set.has()` membership check — no regex, no coercion, no DB
 *   - Invalid values are silently dropped (no 400) so the request still
 *     falls through to the IP-based detection path.
 *   - Never throws.
 */
export const validateCurrencyHeader = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const raw = req.headers[HEADER_NAME];

  if (typeof raw === "string" && raw.length <= 5) {
    const candidate = raw.trim().toUpperCase();
    if (SUPPORTED_CURRENCIES.has(candidate as SupportedCurrency)) {
      res.locals.overrideCurrency = candidate as SupportedCurrency;
    } else if (candidate.length > 0) {
      logger.debug("validateCurrencyHeader: ignoring invalid header", {
        header: candidate.replace(/[^\x20-\x7E]/g, ""),
      });
    }
  }

  next();
};
