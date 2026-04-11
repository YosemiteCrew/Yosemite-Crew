import {
  formatHistoryDateTime,
  formatHistoryDate,
  getHistoryTypeLabel,
  getTypeBadgeClassName,
  getPayloadString,
  getPayloadNumber,
  getPayloadBoolean,
  formatCurrency,
  getPrimaryActionLabel,
} from '@/app/features/companionHistory/utils/historyFormatters';
import { HistoryEntry, HistoryEntryType } from '@/app/features/companionHistory/types/history';

describe('formatHistoryDateTime', () => {
  it('returns dash for null', () => {
    expect(formatHistoryDateTime(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatHistoryDateTime(undefined)).toBe('-');
  });

  it('returns dash for invalid date string', () => {
    expect(formatHistoryDateTime('not-a-date')).toBe('-');
  });

  it('returns formatted string for valid ISO date', () => {
    const result = formatHistoryDateTime('2025-01-15T10:30:00Z');
    expect(typeof result).toBe('string');
    expect(result).toContain('2025');
  });
});

describe('formatHistoryDate', () => {
  it('returns dash for null', () => {
    expect(formatHistoryDate(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatHistoryDate(undefined)).toBe('-');
  });

  it('returns dash for invalid date', () => {
    expect(formatHistoryDate('bad-date')).toBe('-');
  });

  it('returns formatted date for valid date', () => {
    const result = formatHistoryDate('2025-06-01');
    expect(result).toContain('2025');
  });
});

describe('getHistoryTypeLabel', () => {
  it('returns SOAP / Form for FORM_SUBMISSION', () => {
    expect(getHistoryTypeLabel('FORM_SUBMISSION')).toBe('SOAP / Form');
  });

  it('returns Lab for LAB_RESULT', () => {
    expect(getHistoryTypeLabel('LAB_RESULT')).toBe('Lab');
  });

  it('returns Finance for INVOICE', () => {
    expect(getHistoryTypeLabel('INVOICE')).toBe('Finance');
  });

  it('capitalizes first char and lowercases rest for other types', () => {
    expect(getHistoryTypeLabel('APPOINTMENT')).toBe('Appointment');
    expect(getHistoryTypeLabel('TASK')).toBe('Task');
    expect(getHistoryTypeLabel('DOCUMENT')).toBe('Document');
  });
});

describe('getTypeBadgeClassName', () => {
  it('returns blue for APPOINTMENT', () => {
    expect(getTypeBadgeClassName('APPOINTMENT')).toContain('blue');
  });

  it('returns violet for TASK', () => {
    expect(getTypeBadgeClassName('TASK')).toContain('violet');
  });

  it('returns cyan for FORM_SUBMISSION', () => {
    expect(getTypeBadgeClassName('FORM_SUBMISSION')).toContain('cyan');
  });

  it('returns amber for DOCUMENT', () => {
    expect(getTypeBadgeClassName('DOCUMENT')).toContain('amber');
  });

  it('returns teal for LAB_RESULT', () => {
    expect(getTypeBadgeClassName('LAB_RESULT')).toContain('teal');
  });

  it('returns emerald for INVOICE', () => {
    expect(getTypeBadgeClassName('INVOICE')).toContain('emerald');
  });
});

describe('getPayloadString', () => {
  it('returns first matching string value', () => {
    const result = getPayloadString({ a: 'hello', b: 'world' }, ['a', 'b']);
    expect(result).toBe('hello');
  });

  it('skips empty strings', () => {
    const result = getPayloadString({ a: '', b: 'world' }, ['a', 'b']);
    expect(result).toBe('world');
  });

  it('skips non-string values', () => {
    const result = getPayloadString({ a: 123, b: 'text' }, ['a', 'b']);
    expect(result).toBe('text');
  });

  it('returns null when no matching key', () => {
    const result = getPayloadString({ a: '' }, ['a']);
    expect(result).toBeNull();
  });

  it('returns null for empty keys array', () => {
    expect(getPayloadString({ a: 'x' }, [])).toBeNull();
  });
});

describe('getPayloadNumber', () => {
  it('returns first matching number value', () => {
    const result = getPayloadNumber({ a: 42, b: 10 }, ['a', 'b']);
    expect(result).toBe(42);
  });

  it('parses numeric string', () => {
    const result = getPayloadNumber({ a: '3.14' }, ['a']);
    expect(result).toBe(3.14);
  });

  it('skips non-finite numbers', () => {
    const result = getPayloadNumber({ a: Infinity, b: 5 }, ['a', 'b']);
    expect(result).toBe(5);
  });

  it('returns null when no numeric key found', () => {
    const result = getPayloadNumber({ a: 'not-a-number' }, ['a']);
    expect(result).toBeNull();
  });

  it('returns null for empty keys array', () => {
    expect(getPayloadNumber({ a: 1 }, [])).toBeNull();
  });
});

describe('getPayloadBoolean', () => {
  it('returns true when found', () => {
    expect(getPayloadBoolean({ active: true }, ['active'])).toBe(true);
  });

  it('returns false when found', () => {
    expect(getPayloadBoolean({ active: false }, ['active'])).toBe(false);
  });

  it('skips non-boolean values', () => {
    expect(getPayloadBoolean({ a: 'true', b: true }, ['a', 'b'])).toBe(true);
  });

  it('returns null when no boolean found', () => {
    expect(getPayloadBoolean({ a: 'yes' }, ['a'])).toBeNull();
  });

  it('returns null for empty keys array', () => {
    expect(getPayloadBoolean({ a: true }, [])).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('returns null when amount is null', () => {
    expect(formatCurrency(null)).toBeNull();
  });

  it('formats USD amount', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toContain('1,234.56');
  });

  it('formats EUR amount', () => {
    const result = formatCurrency(100, 'EUR');
    expect(result).not.toBeNull();
  });

  it('defaults to USD when no currency provided', () => {
    const result = formatCurrency(50);
    expect(result).toContain('$50');
  });

  it('falls back gracefully for invalid currency', () => {
    const result = formatCurrency(10, 'INVALID_CURRENCY_CODE');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

describe('getPrimaryActionLabel', () => {
  it('returns Open file for DOCUMENT', () => {
    expect(getPrimaryActionLabel({ type: 'DOCUMENT' } as HistoryEntry)).toBe('Open file');
  });

  it('returns Open result for LAB_RESULT', () => {
    expect(getPrimaryActionLabel({ type: 'LAB_RESULT' } as HistoryEntry)).toBe('Open result');
  });

  it('returns Open finance for INVOICE', () => {
    expect(getPrimaryActionLabel({ type: 'INVOICE' } as HistoryEntry)).toBe('Open finance');
  });

  it('returns Open submission for FORM_SUBMISSION', () => {
    expect(getPrimaryActionLabel({ type: 'FORM_SUBMISSION' } as HistoryEntry)).toBe(
      'Open submission'
    );
  });

  it('returns Open task for TASK', () => {
    expect(getPrimaryActionLabel({ type: 'TASK' } as HistoryEntry)).toBe('Open task');
  });

  it('returns Open appointment for APPOINTMENT', () => {
    expect(getPrimaryActionLabel({ type: 'APPOINTMENT' } as HistoryEntry)).toBe('Open appointment');
  });
});
