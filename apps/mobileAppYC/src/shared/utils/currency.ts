import currencyList from '@/shared/utils/currencyList.json';

export type CurrencyCode = 'EUR' | 'USD';

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ['EUR', 'USD'];

type CurrencyRecord = {
  code: string;
  symbol: string;
  name: string;
};

const currencyMap: Record<string, CurrencyRecord> = (currencyList as CurrencyRecord[]).reduce(
  (accumulator, entry) => {
    accumulator[entry.code] = entry;
    return accumulator;
  },
  {} as Record<string, CurrencyRecord>,
);

/**
 * Filter to only supported currencies (EUR, USD)
 */
const supportedCurrencyMap: Record<string, CurrencyRecord> = SUPPORTED_CURRENCIES.reduce(
  (acc, code) => {
    if (currencyMap[code]) {
      acc[code] = currencyMap[code];
    }
    return acc;
  },
  {} as Record<string, CurrencyRecord>,
);

/**
 * Resolve currency symbol from code. Only supports EUR and USD.
 * Falls back to $ if code is missing or not supported.
 */
export const resolveCurrencySymbol = (code?: string, fallback = '$'): string => {
  if (!code) {
    return fallback;
  }

  const normalized = code.toUpperCase();
  return supportedCurrencyMap[normalized]?.symbol ?? fallback;
};

interface FormatCurrencyOptions {
  currencyCode?: string;
  locale?: string;
  minimumFractionDigits?: number;
}

export const formatCurrency = (
  amount: number,
  {
    currencyCode = 'USD',
    locale = 'en-US',
    minimumFractionDigits = 0,
  }: FormatCurrencyOptions = {},
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
    }).format(amount);
  } catch {
    const symbol = resolveCurrencySymbol(currencyCode, '$');
    return `${symbol}${amount.toFixed(minimumFractionDigits)}`;
  }
};

/**
 * Get the currency record (code, symbol, name) for a given currency code
 * Only returns if the currency is supported (EUR or USD)
 */
export const getCurrencyRecord = (code?: string): CurrencyRecord | null => {
  if (!code) {
    return null;
  }
  const normalized = code.toUpperCase();
  return supportedCurrencyMap[normalized] ?? null;
};

/**
 * Format a currency amount with proper symbol and localization
 * Handles cases where currency code might be missing by using fallback
 */
export const formatCurrencyAmount = (
  amount: number,
  currencyCode?: string,
  options: FormatCurrencyOptions = {},
): string => {
  const code = currencyCode || options.currencyCode || 'USD';
  return formatCurrency(amount, {
    ...options,
    currencyCode: code,
  });
};

/**
 * Get all supported currencies (EUR and USD) as an array
 */
export const getAllCurrencies = (): CurrencyRecord[] => {
  return Object.values(supportedCurrencyMap);
};
