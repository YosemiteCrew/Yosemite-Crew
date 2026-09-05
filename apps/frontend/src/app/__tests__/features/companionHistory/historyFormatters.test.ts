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
  getHistoryTypeBadgeTone,
  getHistoryStatusBadgeTone,
} from '@/app/features/companionHistory/utils/historyFormatters';
import { HistoryEntry } from '@/app/features/companionHistory/types/history';

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

  /* Pins the preferred timezone, not the device one. 10:30 UTC is 11:30 in
     Europe/Berlin (the DEFAULT_TIMEZONE these helpers fall back to when nothing
     is stored), and the hour is two digits. Before the switch to
     `formatDateTimeLocal` this read "Jan 15, 2025, 5:30 AM" on a New York
     laptop and "11:30 AM" on the Audit tab of the same record. */
  it('formats a valid ISO date in the preferred timezone', () => {
    expect(formatHistoryDateTime('2025-01-15T10:30:00Z')).toBe('Jan 15, 2025, 11:30 AM');
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

  it('formats a valid date as the app-wide short date', () => {
    expect(formatHistoryDate('2025-06-01')).toBe('Jun 1, 2025');
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

describe('getHistoryTypeBadgeTone', () => {
  it('returns brand for APPOINTMENT', () => {
    expect(getHistoryTypeBadgeTone('APPOINTMENT')).toBe('brand');
  });

  it('returns warning for TASK', () => {
    expect(getHistoryTypeBadgeTone('TASK')).toBe('warning');
  });

  it('returns brand for FORM_SUBMISSION', () => {
    expect(getHistoryTypeBadgeTone('FORM_SUBMISSION')).toBe('brand');
  });

  it('returns neutral for DOCUMENT', () => {
    expect(getHistoryTypeBadgeTone('DOCUMENT')).toBe('neutral');
  });

  it('returns success for LAB_RESULT', () => {
    expect(getHistoryTypeBadgeTone('LAB_RESULT')).toBe('success');
  });

  it('returns brand for other types', () => {
    expect(getHistoryTypeBadgeTone('INVOICE')).toBe('brand');
  });
});

describe('getHistoryStatusBadgeTone', () => {
  it('returns neutral for null status', () => {
    expect(getHistoryStatusBadgeTone(null)).toBe('neutral');
  });

  it('returns neutral for undefined status', () => {
    expect(getHistoryStatusBadgeTone(undefined)).toBe('neutral');
  });

  it('returns neutral for empty/blank status', () => {
    expect(getHistoryStatusBadgeTone('   ')).toBe('neutral');
  });

  it('returns success for completed-like statuses, case-insensitively', () => {
    expect(getHistoryStatusBadgeTone('paid')).toBe('success');
    expect(getHistoryStatusBadgeTone('SIGNED')).toBe('success');
    expect(getHistoryStatusBadgeTone('Approved')).toBe('success');
    expect(getHistoryStatusBadgeTone('done')).toBe('success');
    expect(getHistoryStatusBadgeTone('completed')).toBe('success');
  });

  it('returns warning for pending-like statuses', () => {
    expect(getHistoryStatusBadgeTone('pending')).toBe('warning');
    expect(getHistoryStatusBadgeTone('awaiting_payment')).toBe('warning');
    expect(getHistoryStatusBadgeTone('in_progress')).toBe('warning');
    expect(getHistoryStatusBadgeTone('requested')).toBe('warning');
  });

  it('returns danger for cancelled/failed-like statuses', () => {
    expect(getHistoryStatusBadgeTone('cancelled')).toBe('danger');
    expect(getHistoryStatusBadgeTone('canceled')).toBe('danger');
    expect(getHistoryStatusBadgeTone('rejected')).toBe('danger');
    expect(getHistoryStatusBadgeTone('failed')).toBe('danger');
    expect(getHistoryStatusBadgeTone('overdue')).toBe('danger');
    expect(getHistoryStatusBadgeTone('void')).toBe('danger');
  });

  it('returns neutral for unrecognized statuses', () => {
    expect(getHistoryStatusBadgeTone('unknown-status')).toBe('neutral');
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
    expect(formatCurrency(100, 'EUR')).toBe('\u20AC100.00');
  });

  it('defaults to USD when no currency provided', () => {
    const result = formatCurrency(50);
    expect(result).toContain('$50');
  });

  it('falls back gracefully for invalid currency', () => {
    expect(formatCurrency(10, 'INVALID_CURRENCY_CODE')).toBe('INVALID_CURRENCY_CODE 10.00');
  });

  // Formatters are cached per currency code. Each of these would pass with a
  // single shared formatter or a cache keyed on the wrong thing, so they are
  // asserted together and by exact symbol.
  it('keeps each currency on its own formatter across repeated calls', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatCurrency(1234.5, 'GBP')).toBe('\u00A31,234.50');
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatCurrency(1234.5, 'GBP')).toBe('\u00A31,234.50');
  });

  it('lower-cased codes reuse the same formatter as their upper-cased form', () => {
    expect(formatCurrency(9.5, 'eur')).toBe(formatCurrency(9.5, 'EUR'));
  });

  it('an unsupported code does not disturb the next supported one', () => {
    expect(formatCurrency(10, 'NOT_A_CURRENCY')).toBe('NOT_A_CURRENCY 10.00');
    expect(formatCurrency(10, 'USD')).toBe('$10.00');
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
