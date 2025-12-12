import {
  resolveCurrencySymbol,
  formatCurrency,
  getCurrencyRecord,
  formatCurrencyAmount,
  getAllCurrencies,
} from '../../src/shared/utils/currency';

// --- Mocks ---

// Mock the JSON import to ensure predictable data for the internal maps
jest.mock('../../src/shared/utils/currencyList.json', () => [
  {code: 'USD', symbol: '$', name: 'US Dollar'},
  {code: 'EUR', symbol: '€', name: 'Euro'},
  {code: 'GBP', symbol: '£', name: 'British Pound'}, // Included to verify it gets filtered out
]);

describe('currency Utils', () => {
  // ---------------------------------------------------------------------------
  // 1. resolveCurrencySymbol
  // ---------------------------------------------------------------------------
  describe('resolveCurrencySymbol', () => {
    it('resolves symbol for supported currency (USD)', () => {
      expect(resolveCurrencySymbol('USD')).toBe('$');
    });

    it('resolves symbol for supported currency (EUR)', () => {
      expect(resolveCurrencySymbol('EUR')).toBe('€');
    });

    it('handles lowercase input', () => {
      expect(resolveCurrencySymbol('usd')).toBe('$');
    });

    it('returns default fallback ($) for unsupported currency (GBP)', () => {
      // GBP is in the JSON mock but NOT in SUPPORTED_CURRENCIES list in the source file
      expect(resolveCurrencySymbol('GBP')).toBe('$');
    });

    it('returns custom fallback when provided', () => {
      expect(resolveCurrencySymbol('XYZ', 'FAIL')).toBe('FAIL');
    });

    it('returns fallback if code is undefined', () => {
      expect(resolveCurrencySymbol(undefined, 'N/A')).toBe('N/A');
    });

    it('returns fallback if code is null', () => {
        // @ts-ignore testing js behavior
        expect(resolveCurrencySymbol(null, 'N/A')).toBe('N/A');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. formatCurrency
  // ---------------------------------------------------------------------------
  describe('formatCurrency', () => {
    it('formats USD correctly using Intl', () => {
      // Note: Output depends on Node/Jest locale environment, usually contains non-breaking space (A0)
      const result = formatCurrency(1000, {currencyCode: 'USD'});
      expect(result).toMatch(/\$1,000/);
    });

    it('formats EUR correctly using Intl', () => {
      const result = formatCurrency(1000, {currencyCode: 'EUR'});
      expect(result).toMatch(/€1,000/);
    });

    it('respects minimumFractionDigits option', () => {
      const result = formatCurrency(10.5, {currencyCode: 'USD', minimumFractionDigits: 2});
      expect(result).toMatch(/\$10.50/);
    });

    it('defaults to USD and en-US if options are empty', () => {
      const result = formatCurrency(100);
      expect(result).toMatch(/\$100/);
    });

    // *** CATCH BLOCK COVERAGE ***
    it('falls back to manual formatting when Intl.NumberFormat throws (Invalid Code)', () => {
      // Passing an invalid currency code causes Intl.NumberFormat to throw a RangeError
      // This triggers the catch block: returns `${symbol}${amount.toFixed(...)}`

      const result = formatCurrency(123.456, {
        currencyCode: 'INVALID_CODE_XYZ',
        minimumFractionDigits: 2
      });

      // resolveCurrencySymbol('INVALID_CODE_XYZ') -> '$'
      // 123.456.toFixed(2) -> "123.46"
      expect(result).toBe('$123.46');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. getCurrencyRecord
  // ---------------------------------------------------------------------------
  describe('getCurrencyRecord', () => {
    it('returns record for supported currency', () => {
      const record = getCurrencyRecord('EUR');
      expect(record).toEqual({code: 'EUR', symbol: '€', name: 'Euro'});
    });

    it('handles lowercase input', () => {
      const record = getCurrencyRecord('eur');
      expect(record).toEqual({code: 'EUR', symbol: '€', name: 'Euro'});
    });

    it('returns null for unsupported currency', () => {
      // GBP exists in JSON but is not in SUPPORTED_CURRENCIES const
      expect(getCurrencyRecord('GBP')).toBeNull();
    });

    it('returns null for unknown currency', () => {
      expect(getCurrencyRecord('XYZ')).toBeNull();
    });

    it('returns null if code is undefined', () => {
      expect(getCurrencyRecord(undefined)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. formatCurrencyAmount
  // ---------------------------------------------------------------------------
  describe('formatCurrencyAmount', () => {
    it('formats using the explicitly passed currencyCode argument', () => {
      const result = formatCurrencyAmount(50, 'EUR');
      expect(result).toMatch(/€50/);
    });

    it('formats using options.currencyCode if first arg is missing', () => {
      const result = formatCurrencyAmount(50, undefined, {currencyCode: 'EUR'});
      expect(result).toMatch(/€50/);
    });

    it('defaults to USD if no code is provided', () => {
      const result = formatCurrencyAmount(50);
      expect(result).toMatch(/\$50/);
    });

    it('prioritizes explicit argument over options', () => {
      const result = formatCurrencyAmount(50, 'EUR', {currencyCode: 'USD'});
      expect(result).toMatch(/€50/);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. getAllCurrencies
  // ---------------------------------------------------------------------------
  describe('getAllCurrencies', () => {
    it('returns list of supported currencies only', () => {
      const list = getAllCurrencies();

      expect(list).toHaveLength(2); // Only EUR and USD are supported
      expect(list).toContainEqual({code: 'USD', symbol: '$', name: 'US Dollar'});
      expect(list).toContainEqual({code: 'EUR', symbol: '€', name: 'Euro'});

      // Should NOT contain GBP despite it being in the json mock
      expect(list.find(c => c.code === 'GBP')).toBeUndefined();
    });
  });
});