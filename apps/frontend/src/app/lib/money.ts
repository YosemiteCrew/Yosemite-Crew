/**
 * Every formatter here takes `undefined` for a currency that is not known yet
 * (`useCurrencyForPrimaryOrg` before billing has loaded) and prints the bare
 * amount: a figure with no symbol is honest, one labelled in a guessed
 * currency is not (#3607).
 */
export const formatMoney = (amount: number, currency: string | undefined) =>
  new Intl.NumberFormat('en-US', {
    ...(currency ? { style: 'currency', currency } : {}),
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * The bare currency symbol for an ISO-4217 code (e.g. USD → "$", GBP → "£", INR → "₹"),
 * used for input adornments and hints so the bill builder never hardcodes "$" for non-USD orgs.
 * Falls back to the code itself for unknown/invalid currencies, and to nothing
 * when the currency is not known.
 */
export const currencySymbol = (currency: string | undefined): string => {
  if (!currency) return '';
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

/** A field label naming the currency when it is known: "Price (GBP)", else "Price". */
export const labelWithCurrency = (label: string, currency: string | undefined): string =>
  currency ? `${label} (${currency})` : label;

/**
 * Money with its minor units kept, e.g. 45.5 GBP -> "£45.50".
 *
 * `formatMoney` above rounds to whole units, which is right for the dashboard
 * tiles it was written for but wrong anywhere a figure has to reconcile with
 * another figure - an estimate line against its total, or an estimate against
 * the invoice it converts into.
 */
export const formatMoneyPrecise = (amount: number, currency: string | undefined) => {
  if (!currency) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
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
 * Invoices and estimates each carry the currency they were written in, and
 * that is the only value that can be trusted to match the stored amount - the
 * organisation's currency can have changed since (#2597).
 */
export const recordCurrency = (
  record: { currency?: string | null } | null | undefined,
  fallback: string | undefined
): string | undefined => {
  const own = record?.currency;
  return typeof own === 'string' && own.trim() ? own.trim() : fallback;
};

/**
 * The one currency a set of records shares, or the fallback when they do not.
 *
 * An aggregate figure - a week's takings, a total outstanding - is a sum across
 * records, so it can only carry a currency if every record agrees on one.
 * Where they do, labelling the total in the ambient organisation value would
 * print "$48,797 outstanding" above a list of cards reading "GBP 145". Where
 * they genuinely differ the sum is not meaningful in any single currency, and
 * the fallback at least does not claim otherwise.
 */
export const sharedCurrency = (
  records: ReadonlyArray<{ currency?: string | null }>,
  fallback: string | undefined
): string | undefined => {
  let shared: string | null = null;
  for (const record of records) {
    const own = record.currency;
    if (typeof own !== 'string' || !own.trim()) continue;
    const code = own.trim();
    if (shared === null) shared = code;
    else if (shared !== code) return fallback;
  }
  return shared ?? fallback;
};
