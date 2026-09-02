export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * The bare currency symbol for an ISO-4217 code (e.g. USD → "$", GBP → "£", INR → "₹"),
 * used for input adornments and hints so the bill builder never hardcodes "$" for non-USD orgs.
 * Falls back to the code itself for unknown/invalid currencies.
 */
export const currencySymbol = (currency: string): string => {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
};

/**
 * Money with its minor units kept, e.g. 45.5 GBP -> "£45.50".
 *
 * `formatMoney` above rounds to whole units, which is right for the dashboard
 * tiles it was written for but wrong anywhere a figure has to reconcile with
 * another figure - an estimate line against its total, or an estimate against
 * the invoice it converts into.
 */
export const formatMoneyPrecise = (amount: number, currency: string) => {
  try {
    // No explicit fraction digits: Intl already knows each currency's minor
    // unit, so JPY prints no decimals and KWD prints three. Pinning two would
    // display a different amount from the one stored - KWD 1.234 as 1.23.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    // A three-character code that is not a currency (the estimate API's schema
    // only checks length) makes the constructor throw, and this helper runs on
    // every line and total with no error boundary above it - one such record
    // would blank the whole screen.
    return `${currency} ${amount.toFixed(2)}`;
  }
};

/**
 * The currency a money figure actually belongs to.
 *
 * Prefer the record's own `currency` over any ambient organisation value.
 * `useCurrencyForPrimaryOrg` reads `subscription.currency`, which
 * `normalizeSubscription` never populates, so it always answers USD - see
 * #2597. Invoices and estimates each carry the currency they were written in,
 * and that is the only value that can be trusted to match the stored amount.
 */
export const recordCurrency = (
  record: { currency?: string | null } | null | undefined,
  fallback: string
): string => {
  const own = record?.currency;
  return typeof own === 'string' && own.trim() ? own.trim() : fallback;
};
