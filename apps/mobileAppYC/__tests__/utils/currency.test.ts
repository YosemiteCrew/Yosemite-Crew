import {resolveCurrencySymbol, formatCurrency} from '@/shared/utils/currency';

describe('currency', () => {
  // Store original Intl.NumberFormat
  const originalNumberFormat = globalThis.Intl.NumberFormat;

  afterAll(() => {
    // Restore original after all tests in this file
    globalThis.Intl.NumberFormat = originalNumberFormat;
  });

  beforeEach(() => {
    // Restore the real implementation before each test
    globalThis.Intl.NumberFormat = originalNumberFormat;
  });

  describe('resolveCurrencySymbol', () => {
    it('should return the fallback if no code is provided', () => {
      expect(resolveCurrencySymbol()).toBe('$');
    });

    it('should return the fallback for an undefined code', () => {
      // FIX: Removed redundant 'undefined'
      expect(resolveCurrencySymbol()).toBe('$');
    });

    it('should return the correct symbol for a valid code (USD)', () => {
      expect(resolveCurrencySymbol('USD')).toBe('$');
    });

    it('should be case-insensitive (eur -> €)', () => {
      expect(resolveCurrencySymbol('eur')).toBe('€');
    });

    it('should return the fallback for an unsupported code', () => {
      expect(resolveCurrencySymbol('INR')).toBe('$');
    });

    it('should return a custom fallback if provided', () => {
      expect(resolveCurrencySymbol('XYZ', '???')).toBe('???');
    });
  });

  describe('formatCurrency', () => {
    it('should format with default options (USD, en-US, 0 digits)', () => {
      expect(formatCurrency(1234)).toBe('$1,234');
    });

    it('should format with specified options (EUR, de-DE, 2 digits)', () => {
      const options = {
        currencyCode: 'EUR',
        locale: 'de-DE',
        minimumFractionDigits: 2,
      };
      // German locale uses '.' for thousands and ',' for decimal
      expect(formatCurrency(1234.56, options)).toBe('1.234,56 €');
    });

    it('should use the fallback formatter if Intl.NumberFormat fails', () => {
      // FIX: Force Intl.NumberFormat to throw an error
      globalThis.Intl.NumberFormat = jest.fn().mockImplementation(() => {
        throw new Error('Invalid locale');
      }) as any; // FIX: Cast to 'any' to bypass static property check

      const options = {
        currencyCode: 'USD',
        locale: 'invalid-locale',
        minimumFractionDigits: 2,
      };

      expect(formatCurrency(100, options)).toBe('$100.00');
    });

    it('should use the fallback symbol if Intl fails and currency is unknown', () => {
      // FIX: Force Intl.NumberFormat to throw an error
      globalThis.Intl.NumberFormat = jest.fn().mockImplementation(() => {
        throw new Error('Invalid currency');
      }) as any; // FIX: Cast to 'any' to bypass static property check

      const options = {
        currencyCode: 'XYZ', // Unknown currency
        locale: 'invalid-locale',
        minimumFractionDigits: 1,
      };

      expect(formatCurrency(75.5, options)).toBe('$75.5');
    });
  });
});
