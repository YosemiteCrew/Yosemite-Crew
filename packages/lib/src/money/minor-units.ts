/**
 * Currency-exponent-aware minor-unit conversion.
 *
 * Payment providers transact in the smallest unit of a currency (its minor
 * unit): cents for USD, but whole yen for JPY (0 decimals) and thousandths of a
 * dinar for BHD (3 decimals). A fixed multiply-by-100 over-charges or
 * under-charges every currency whose minor-unit exponent is not 2. These helpers
 * convert between major units (the amount a person reads, e.g. 19.99) and minor
 * units (what a provider expects, e.g. 1999) using the ISO 4217 exponent.
 */

const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const THREE_DECIMAL_CURRENCIES = new Set<string>(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

const FOUR_DECIMAL_CURRENCIES = new Set<string>(['CLF', 'UYW']);

const DEFAULT_EXPONENT = 2;

/** Precision (decimal places) used to absorb binary floating-point drift before the final integer round. */
const DE_DRIFT_PRECISION = 4;

function normalizeCurrency(currency: string): string {
  if (typeof currency !== 'string') {
    throw new RangeError('Currency code must be a string');
  }
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new RangeError(`Invalid ISO 4217 currency code: ${JSON.stringify(currency)}`);
  }
  return code;
}

/**
 * Returns the number of decimal places (the minor-unit exponent) for an ISO 4217
 * currency code. Case-insensitive. Currencies not in the zero-, three-, or
 * four-decimal sets default to two decimals, which is the ISO 4217 default.
 *
 * @throws RangeError if the code is not a three-letter alphabetic string.
 */
export function getCurrencyExponent(currency: string): number {
  const code = normalizeCurrency(currency);
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0;
  }
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3;
  }
  if (FOUR_DECIMAL_CURRENCIES.has(code)) {
    return 4;
  }
  return DEFAULT_EXPONENT;
}

/**
 * Converts a major-unit amount (e.g. 19.99) to an integer count of minor units
 * (e.g. 1999) for the given currency. Rounds half away from zero to the nearest
 * minor unit.
 *
 * @throws RangeError if the amount is not finite or the currency code is invalid.
 */
export function toMinorUnits(majorAmount: number, currency: string): number {
  if (typeof majorAmount !== 'number' || !Number.isFinite(majorAmount)) {
    throw new RangeError(`Amount must be a finite number, received ${JSON.stringify(majorAmount)}`);
  }
  const exponent = getCurrencyExponent(currency);
  const factor = 10 ** exponent;
  // Scaling a float by a power of ten reintroduces representation error
  // (1.1 * 100 === 110.00000000000001). Fix the value at a precision a few places
  // beyond the target, then round to the nearest integer half away from zero.
  const scaled = Number((majorAmount * factor).toFixed(DE_DRIFT_PRECISION));
  const minor = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return minor === 0 ? 0 : minor;
}

/**
 * Converts an integer count of minor units (e.g. 1999) back to a major-unit
 * amount (e.g. 19.99) for the given currency.
 *
 * @throws RangeError if the minor amount is not an integer or the currency code is invalid.
 */
export function fromMinorUnits(minorAmount: number, currency: string): number {
  if (!Number.isInteger(minorAmount)) {
    throw new RangeError(
      `Minor amount must be an integer, received ${JSON.stringify(minorAmount)}`
    );
  }
  const exponent = getCurrencyExponent(currency);
  const major = minorAmount / 10 ** exponent;
  return major === 0 ? 0 : major;
}
