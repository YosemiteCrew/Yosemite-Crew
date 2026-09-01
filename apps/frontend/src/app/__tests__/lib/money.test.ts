import { currencySymbol, formatMoney, formatMoneyPrecise } from '@/app/lib/money';

describe('formatMoney', () => {
  it('formats USD correctly', () => {
    expect(formatMoney(1000, 'USD')).toBe('$1,000');
  });

  it('formats zero amount', () => {
    expect(formatMoney(0, 'USD')).toBe('$0');
  });

  it('formats large amounts with thousand separators', () => {
    expect(formatMoney(1500000, 'USD')).toBe('$1,500,000');
  });

  it('formats EUR correctly', () => {
    const result = formatMoney(500, 'EUR');
    expect(result).toContain('500');
    expect(result).toContain('€');
  });

  it('rounds to no decimal places', () => {
    // maximumFractionDigits: 0 means decimals are stripped
    const result = formatMoney(9.99, 'USD');
    expect(result).toBe('$10');
  });

  it('formats negative amounts', () => {
    const result = formatMoney(-200, 'USD');
    expect(result).toContain('200');
  });
});

describe('formatMoneyPrecise', () => {
  it('keeps both decimal places', () => {
    expect(formatMoneyPrecise(45.5, 'GBP')).toBe('£45.50');
  });

  it('renders a whole number with .00 rather than bare units', () => {
    expect(formatMoneyPrecise(100, 'USD')).toBe('$100.00');
  });

  it('uses the pound symbol for GBP and the dollar symbol for USD', () => {
    expect(formatMoneyPrecise(12.34, 'GBP')).toBe('£12.34');
    expect(formatMoneyPrecise(12.34, 'USD')).toBe('$12.34');
  });

  it('formats zero as 0.00', () => {
    expect(formatMoneyPrecise(0, 'GBP')).toBe('£0.00');
  });

  it('keeps thousand separators alongside the minor units', () => {
    expect(formatMoneyPrecise(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('formats a negative amount', () => {
    expect(formatMoneyPrecise(-12.5, 'USD')).toBe('-$12.50');
  });

  it('rounds a third decimal away rather than truncating', () => {
    expect(formatMoneyPrecise(9.999, 'USD')).toBe('$10.00');
    expect(formatMoneyPrecise(1.005, 'USD')).toBe('$1.01');
  });

  it('does not round to whole units the way formatMoney does', () => {
    // formatMoney is for dashboard tiles; a figure that has to reconcile with
    // another figure - an estimate line against its total - needs the pennies.
    expect(formatMoney(9.99, 'USD')).toBe('$10');
    expect(formatMoneyPrecise(9.99, 'USD')).toBe('$9.99');
  });
});

describe('currencySymbol', () => {
  it('returns the bare symbol for the codes the finance screens use', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('INR')).toBe('₹');
  });

  it('returns the code itself when there is no distinct symbol for it', () => {
    expect(currencySymbol('XYZ')).toBe('XYZ');
  });

  it('falls back to the code rather than throwing on a malformed one', () => {
    expect(currencySymbol('US')).toBe('US');
    expect(currencySymbol('not-a-code')).toBe('not-a-code');
  });

  it('falls back to the code when the runtime emits no currency part', () => {
    const formatToParts = jest
      .spyOn(Intl.NumberFormat.prototype, 'formatToParts')
      .mockReturnValue([{ type: 'integer', value: '0' }]);

    expect(currencySymbol('USD')).toBe('USD');

    formatToParts.mockRestore();
  });
});

describe('formatMoneyPrecise currency precision', () => {
  it('uses each currency its own minor unit rather than a fixed two digits', () => {
    // JPY has no minor unit and KWD has three. Pinning two digits displayed a
    // different amount from the one stored - KWD 1.234 as 1.23.
    expect(formatMoneyPrecise(1234, 'JPY')).not.toContain('.');
    expect(formatMoneyPrecise(1.234, 'KWD')).toContain('1.234');
    expect(formatMoneyPrecise(45.5, 'GBP')).toBe('£45.50');
  });

  it('falls back instead of throwing on a code that is not a currency', () => {
    // CreateEstimateSchema only checks the code's length, so "123" is an
    // API-valid estimate. Intl throws a RangeError on it, and this helper runs
    // on every line and total with no error boundary above it - one such record
    // would blank the screen.
    expect(() => formatMoneyPrecise(9.5, '123')).not.toThrow();
    expect(formatMoneyPrecise(9.5, '123')).toBe('123 9.50');
    expect(formatMoneyPrecise(9.5, 'ZZ')).toBe('ZZ 9.50');
  });
});
