import geoip from "geoip-country";

import {
  COUNTRY_TO_CURRENCY,
  DEFAULT_CURRENCY,
  type SupportedCurrency,
} from "src/constants/pricing.constants";

/**
 * Returns the ISO-3166 alpha-2 country code for a given IP address, or `null`
 * for private / loopback / unknown ranges. Pure wrapper around `geoip-country`.
 */
export const getCountryFromIp = (
  ip: string | undefined | null,
): string | null => {
  if (typeof ip !== "string" || ip.length === 0) return null;

  // Express may prefix IPv4 addresses with `::ffff:` when running over IPv6.
  const normalised = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  // Loopback and IPv6 link-local shortcuts — skip the DB lookup entirely.
  if (
    normalised === "::1" ||
    normalised === "127.0.0.1" ||
    normalised === "0.0.0.0" ||
    normalised.startsWith("fe80:")
  ) {
    return null;
  }

  try {
    const result = geoip.lookup(normalised);
    return result?.country ?? null;
  } catch {
    return null;
  }
};

/**
 * Maps a country code (or `null`) to one of our supported currencies. Any
 * country outside the USD / GBP / EUR map — including `null` — resolves to
 * the default currency (USD).
 */
export const resolveCurrencyFromCountry = (
  country: string | null,
): SupportedCurrency => {
  if (country === null) return DEFAULT_CURRENCY;
  const upper = country.toUpperCase();
  return COUNTRY_TO_CURRENCY[upper] ?? DEFAULT_CURRENCY;
};
