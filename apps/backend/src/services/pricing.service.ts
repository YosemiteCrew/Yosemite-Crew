import type { Request } from "express";

import {
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  PRICING_PLANS,
  SUPPORTED_CURRENCIES,
  type PlanDTO,
  type SupportedCurrency,
} from "src/constants/pricing.constants";
import {
  getCountryFromIp,
  resolveCurrencyFromCountry,
} from "src/services/geo.service";

export type CurrencySource = "override" | "ip" | "default";

export interface PricingResponse {
  currency: SupportedCurrency;
  currencySymbol: string;
  source: CurrencySource;
  plans: PlanDTO[];
}

const isSupportedCurrency = (value: unknown): value is SupportedCurrency =>
  typeof value === "string" &&
  SUPPORTED_CURRENCIES.has(value as SupportedCurrency);

/**
 * Priority:
 *   1. Validated override from `res.locals.overrideCurrency` (set by
 *      `validateCurrencyHeader` middleware). Already allowlist-checked.
 *   2. IP-based country → currency lookup.
 *   3. `DEFAULT_CURRENCY` (USD).
 */
export const resolveCurrency = (
  req: Request,
  override: unknown,
): { currency: SupportedCurrency; source: CurrencySource } => {
  if (isSupportedCurrency(override)) {
    return { currency: override, source: "override" };
  }

  const country = getCountryFromIp(req.ip);
  if (country !== null) {
    const mapped = resolveCurrencyFromCountry(country);
    return { currency: mapped, source: "ip" };
  }

  return { currency: DEFAULT_CURRENCY, source: "default" };
};

export const getPricingResponse = (
  req: Request,
  override: unknown,
): PricingResponse => {
  const { currency, source } = resolveCurrency(req, override);
  return {
    currency,
    currencySymbol: CURRENCY_SYMBOLS[currency],
    source,
    plans: PRICING_PLANS[currency],
  };
};
