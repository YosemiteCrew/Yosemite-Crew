// Canonical ledger precision for a currency: how many fractional digits an
// amount may carry once it is posted. This is a different question from the
// integer amount a payment provider accepts, which `utils/stripe-minor-units`
// answers for Stripe and which must never be read as ledger precision — a
// provider's supported set is a property of that provider, not of the money.
//
// Kept free of imports on purpose, like its provider-side sibling: the pure
// pricing modules that need it must not gain a database dependency.

/**
 * Currency codes this runtime knows, as ICU reports them. Membership comes from
 * here rather than from `Intl.NumberFormat` succeeding, because a well-formed
 * but unknown code (`ZZZ`) does not throw — it silently formats with the
 * generic two-digit fallback, which is the exact failure this registry exists
 * to prevent.
 */
const ICU_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Intl.supportedValuesOf("currency"),
);

/**
 * Codes where ICU's fraction digits are the *display* convention rather than
 * ISO 4217's minor unit, so neither number can be trusted as ledger precision
 * without a decided source. ICU reports 0 for all of them; ISO 4217 assigns 2
 * (and 3 for IQD). Rather than post a HUF or IQD amount at a precision one of
 * the two authorities calls wrong, this registry refuses to price them at all.
 *
 * Supporting one of these is additive: give it an explicit ISO minor unit here
 * and drop it from this set. Do not "fix" it by taking the ICU number.
 */
export const AMBIGUOUS_LEDGER_CURRENCIES: ReadonlySet<string> = new Set([
  "AFN",
  "ALL",
  "COP",
  "HUF",
  "IDR",
  "IQD",
  "IRR",
  "KPW",
  "LAK",
  "LBP",
  "MGA",
  "MMK",
  "PKR",
  "SLL",
  "SOS",
  "SYP",
  "YER",
]);

/**
 * Fraction digits the ledger posts a `currency` amount at. Two decimals is a
 * fact about USD, not a default: an unsupported code is rejected so that a
 * JPY or KWD amount can never be quantized at another currency's precision.
 */
export const LEDGER_CURRENCY_EXPONENTS: ReadonlyMap<string, number> = new Map(
  [...ICU_CURRENCY_CODES]
    .filter((code) => !AMBIGUOUS_LEDGER_CURRENCIES.has(code))
    .map((code): [string, number | undefined] => [
      code,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits,
    ])
    // A runtime that reports no fraction digits for a currency has not told
    // us its precision, which is not the same as telling us it has none.
    // Leave it out and let it be refused rather than posted at a guess.
    .filter((entry): entry is [string, number] => entry[1] !== undefined),
);

/** The legacy precision every amount was posted at before this registry. */
export const DEFAULT_LEDGER_EXPONENT = 2;

export class UnsupportedLedgerCurrencyError extends Error {
  readonly currency: string;

  constructor(currency: string) {
    super(`Unsupported ledger currency: ${currency}`);
    this.name = "UnsupportedLedgerCurrencyError";
    this.currency = currency;
  }
}

/**
 * Whether two ISO 4217 codes name the same currency. Invoices and payments
 * carry Stripe's lower-case codes while estimates and claims carry upper-case
 * ones, and rows written before #3607 mix both, so an exact comparison calls
 * one currency two.
 */
export const sameCurrency = (a: string, b: string): boolean =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

/** Whether the ledger can post `currency` at a precision it can defend. */
export const isLedgerCurrencySupported = (
  currency: string | null | undefined,
): boolean =>
  currency != null &&
  LEDGER_CURRENCY_EXPONENTS.has(currency.trim().toUpperCase());

/**
 * Fraction digits for `currency`, or the legacy default when no currency is
 * supplied. Throws for a code this runtime cannot price exactly.
 */
export const resolveLedgerExponent = (
  currency: string | null | undefined,
): number => {
  if (currency == null || currency.trim() === "") {
    return DEFAULT_LEDGER_EXPONENT;
  }

  const code = currency.trim().toUpperCase();
  const exponent = LEDGER_CURRENCY_EXPONENTS.get(code);
  if (exponent === undefined) {
    throw new UnsupportedLedgerCurrencyError(code);
  }

  return exponent;
};

type DecimalParts = {
  negative: boolean;
  digits: string;
  scale: number;
};

/**
 * The shortest decimal that round-trips to `value`, as integer digits and a
 * scale. Reading the shortest form is deliberate: an amount that arrived as
 * `2.675` in JSON is the number a person typed, and its exact binary expansion
 * (2.67499999999999982…) would round the other way.
 */
const decimalParts = (value: number): DecimalParts => {
  const negative = value < 0;
  let text = String(Math.abs(value));

  let exponent = 0;
  const exponentIndex = text.indexOf("e");
  if (exponentIndex >= 0) {
    exponent = Number(text.slice(exponentIndex + 1));
    text = text.slice(0, exponentIndex);
  }

  let scale = 0;
  const pointIndex = text.indexOf(".");
  if (pointIndex >= 0) {
    scale = text.length - pointIndex - 1;
    text = text.slice(0, pointIndex) + text.slice(pointIndex + 1);
  }

  scale -= exponent;
  if (scale < 0) {
    text += "0".repeat(-scale);
    scale = 0;
  }

  return { negative, digits: text, scale };
};

const assertFinite = (value: number): void => {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot quantize a non-finite amount: ${value}`);
  }
};

/**
 * `value` as a whole number of the currency's smallest unit, rounded half away
 * from zero. Exact: the arithmetic runs on integers, never on the scaled float.
 */
export const toLedgerMinorUnits = (value: number, exponent: number): number => {
  assertFinite(value);

  const { negative, digits, scale } = decimalParts(value);
  let units = BigInt(digits);

  if (scale > exponent) {
    const divisor = 10n ** BigInt(scale - exponent);
    const remainder = units % divisor;
    units /= divisor;
    if (remainder * 2n >= divisor) {
      units += 1n;
    }
  } else {
    units *= 10n ** BigInt(exponent - scale);
  }

  if (units > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `Amount exceeds exact integer range at ${exponent} decimals: ${value}`,
    );
  }

  return negative ? -Number(units) : Number(units);
};

/** `minorUnits` back as a major-unit amount at `exponent` decimals. */
export const fromLedgerMinorUnits = (
  minorUnits: number,
  exponent: number,
): number => minorUnits / 10 ** exponent;

/**
 * `value` rounded half away from zero to the currency's posted precision.
 */
export const quantizeMoney = (value: number, exponent: number): number =>
  fromLedgerMinorUnits(toLedgerMinorUnits(value, exponent), exponent);
