// The integer amount Stripe accepts for a currency, which is not the same
// question as how a human reads that amount. Display formatting is CLDR's
// answer and lives in the frontend's own money helper; this is Stripe's answer
// and belongs nowhere near it. The two look like duplicates and are not, so
// this module is named after the API it serves rather than after "money".
//
// Kept free of imports on purpose. The pure pricing modules that need it must
// not gain a database dependency to convert a number.

// Currencies Stripe accepts as a whole number of major units, so the amount is
// submitted unscaled. https://docs.stripe.com/currencies#zero-decimal
//
// Two currencies that ARE zero-decimal in ISO 4217 are deliberately absent,
// because Stripe's Special cases override the general rule for them: UGX and
// ISK "became a zero-decimal currency, but backwards compatibility requires you
// to represent it as a two-decimal value, where the decimal amount is always
// 00." Both are therefore scaled like a two-decimal currency.
// https://docs.stripe.com/currencies#special-cases
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** An amount in the smallest unit Stripe accepts for `currency`. */
export const toStripeMinorUnits = (amount: number, currency: string): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.trim().toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
