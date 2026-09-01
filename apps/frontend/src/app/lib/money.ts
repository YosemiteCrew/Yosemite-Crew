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
export const formatMoneyPrecise = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
