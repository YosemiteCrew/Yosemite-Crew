import {
  resolveCurrencyForBusiness,
  normalizeCurrencyCode,
} from '../../src/shared/utils/currencyResolver';

describe('currencyResolver Utils', () => {
  // ---------------------------------------------------------------------------
  // 1. resolveCurrencyForBusiness
  // ---------------------------------------------------------------------------
  describe('resolveCurrencyForBusiness', () => {
    // --- Explicit Currency Logic ---
    it('returns explicit currency if valid (EUR)', () => {
      expect(resolveCurrencyForBusiness('Any Address, USA', 'EUR')).toBe('EUR');
    });

    it('returns explicit currency if valid (USD)', () => {
      expect(resolveCurrencyForBusiness('Paris, France', 'USD')).toBe('USD');
    });

    it('ignores explicit currency if invalid/unknown and falls back to address logic', () => {
      // 'GBP' is not in the explicit check (explicitCurrency === 'EUR' || explicitCurrency === 'USD')
      // Address 'Paris, France' should resolve to EUR
      expect(resolveCurrencyForBusiness('Paris, France', 'GBP')).toBe('EUR');
    });

    // --- Address Logic (European Patterns) ---
    it('defaults to EUR for UK/Ireland addresses', () => {
      expect(resolveCurrencyForBusiness('London, UK')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Dublin, Ireland')).toBe('EUR');
    });

    it('defaults to EUR for common European countries (France, Germany, Italy, Spain)', () => {
      expect(resolveCurrencyForBusiness('Paris, France')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Berlin, Germany')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Rome, Italy')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Madrid, Spain')).toBe('EUR');
    });

    it('defaults to EUR for other European codes (nl, be, at, ch, se, no, etc.)', () => {
      // Testing a sample of the patterns array to ensure the loop works
      expect(resolveCurrencyForBusiness('Amsterdam, Netherlands')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Brussels, Belgium')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Vienna, Austria')).toBe('EUR');
      expect(resolveCurrencyForBusiness('Zurich, Switzerland')).toBe('EUR'); // ch matches Switzerland pattern logic
    });

    it('defaults to EUR for generic european terms', () => {
      expect(resolveCurrencyForBusiness('Somewhere in Europe')).toBe('EUR');
    });

    // --- Fallback Logic ---
    it('defaults to USD if address does not match European patterns', () => {
      expect(resolveCurrencyForBusiness('New York, USA')).toBe('USD');
      expect(resolveCurrencyForBusiness('Tokyo, Japan')).toBe('USD');
      expect(resolveCurrencyForBusiness('Sydney, Australia')).toBe('USD');
    });

    it('defaults to USD if address is empty or null', () => {
      expect(resolveCurrencyForBusiness(null)).toBe('USD');
      expect(resolveCurrencyForBusiness('')).toBe('USD');
      expect(resolveCurrencyForBusiness(undefined)).toBe('USD');
    });

    it('is case insensitive regarding address matching', () => {
      expect(resolveCurrencyForBusiness('paris, france')).toBe('EUR'); // Lowercase input
      expect(resolveCurrencyForBusiness('PARIS, FRANCE')).toBe('EUR'); // Uppercase input
    });
  });

  // ---------------------------------------------------------------------------
  // 2. normalizeCurrencyCode
  // ---------------------------------------------------------------------------
  describe('normalizeCurrencyCode', () => {
    it('returns USD if code is null, undefined, or empty', () => {
      expect(normalizeCurrencyCode(null)).toBe('USD');
      expect(normalizeCurrencyCode(undefined)).toBe('USD');
      expect(normalizeCurrencyCode('')).toBe('USD');
    });

    it('normalizes EUR variants to EUR', () => {
      expect(normalizeCurrencyCode('EUR')).toBe('EUR');
      expect(normalizeCurrencyCode('eur')).toBe('EUR'); // Case insensitivity
      expect(normalizeCurrencyCode('EURO')).toBe('EUR'); // Alias check
      expect(normalizeCurrencyCode('euro')).toBe('EUR');
    });

    it('normalizes USD variants to USD', () => {
      expect(normalizeCurrencyCode('USD')).toBe('USD');
      expect(normalizeCurrencyCode('usd')).toBe('USD');
      expect(normalizeCurrencyCode('US$')).toBe('USD');
      expect(normalizeCurrencyCode('DOLLAR')).toBe('USD');
    });

    it('defaults to USD for unknown or unsupported codes', () => {
      expect(normalizeCurrencyCode('GBP')).toBe('USD');
      expect(normalizeCurrencyCode('YEN')).toBe('USD');
      expect(normalizeCurrencyCode('XYZ')).toBe('USD');
    });
  });
});