import { formatMoney } from '@/app/lib/money';

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
