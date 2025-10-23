import currencyList from '@/utils/currencyList.json';

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

export const resolveCurrencySymbol = (code?: string, fallback = '$'): string => {
  if (!code) {
    return fallback;
  }

  const normalized = code.toUpperCase();
  return currencyMap[normalized]?.symbol ?? fallback;
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
