import { toLedgerMinorUnits } from "../services/finance/currency";

// The integer amount Stripe accepts for a currency, which is not the same
// question as how a human reads that amount. Display formatting is CLDR's
// answer and lives in the frontend's own money helper; this is Stripe's answer
// and belongs nowhere near it. The two look like duplicates and are not, so
// this module is named after the API it serves rather than after "money".
//
// Uses the pure currency arithmetic helper, which has no database dependency.

// Currencies Stripe accepts as a whole number of major units, so the amount is
// submitted unscaled. https://docs.stripe.com/currencies#zero-decimal
//
// Two currencies that ARE zero-decimal in ISO 4217 are deliberately absent,
// because Stripe's Special cases override the general rule for them: UGX and
// ISK "transitioned to a zero-decimal currency, but backwards compatibility
// requires you to represent it as a two-decimal value, where the decimal amount
// is always 00." Both are therefore scaled like a two-decimal currency.
// https://docs.stripe.com/currencies#special-cases
//
// Read the name precisely: this is "currencies whose CHARGE amount is
// unscaled", not "Stripe's zero-decimal currencies". HUF and TWD are
// zero-decimal for PAYOUTS and are deliberately absent here, because Stripe
// takes two-decimal amounts when charging them. Anyone adding payout support
// and reading this set as the general answer gets those two backwards.
//
// The UGX entry carries one further rule that this function does not implement
// and callers summing minor units across invoice lines must not assume away:
// where an invoice amount is fractional after prorations, coupons or taxes,
// Stripe rounds it to the nearest multiple of 100 itself and credits or debits
// the difference to the customer balance.
//
// Every entry below was verified against the English source on 2026-09-05. The
// docs default their language to the detected region, so an unqualified fetch
// returns a translated page and reads as a transient failure it is not:
// https://docs.stripe.com/currencies?locale=en-US
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

// Currencies whose ledger amount carries three decimals. Scaling one by a
// hundred, as the two-decimal default below does, drops the third digit before
// Stripe ever sees it, and Stripe's own minor unit for these codes is not the
// hundredth either, so what reaches the charge is not the posted amount under
// any reading. Charging one needs its own verified conversion and sandbox
// fixtures (#3153); until then it is refused here, where every outbound amount
// passes, rather than submitted at the wrong scale.
const THREE_DECIMAL_CURRENCIES = new Set([
  "bhd",
  "jod",
  "kwd",
  "lyd",
  "omr",
  "tnd",
]);

export class UnsupportedStripeCurrencyError extends Error {
  readonly currency: string;

  constructor(currency: string) {
    super(`Stripe charges are not supported in ${currency.toUpperCase()}`);
    this.name = "UnsupportedStripeCurrencyError";
    this.currency = currency;
  }
}

/** Whether an amount in `currency` can be submitted to Stripe unchanged. */
export const isStripeChargeCurrencySupported = (currency: string): boolean =>
  !THREE_DECIMAL_CURRENCIES.has(currency.trim().toLowerCase());

/**
 * An amount in the smallest unit Stripe accepts for `currency`. Throws
 * `UnsupportedStripeCurrencyError` for a three-decimal currency.
 */
export const toStripeMinorUnits = (
  amount: number,
  currency: string,
): number => {
  const code = currency.trim().toLowerCase();
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    throw new UnsupportedStripeCurrencyError(code);
  }

  return toLedgerMinorUnits(amount, ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2);
};

/** Convert an amount returned by Stripe to its major currency unit. */
export const fromStripeMinorUnits = (
  amount: number,
  currency: string,
): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency.trim().toLowerCase())
    ? amount
    : amount / 100;
