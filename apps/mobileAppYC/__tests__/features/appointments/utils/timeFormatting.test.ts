// Set timezone to UTC for this test file to ensure consistent formatting
process.env.TZ = 'UTC';

import {
  normalizeTimeString,
  formatTimeLocale,
  formatTimeRange,
  formatDateLocale,
  formatDateTime,
} from '../../../../src/features/appointments/utils/timeFormatting';

describe('timeFormatting utils', () => {
  // =========================================================================
  // 1. normalizeTimeString
  // =========================================================================
  describe('normalizeTimeString', () => {
    it('returns 00:00:00 for null or undefined', () => {
      expect(normalizeTimeString(null)).toBe('00:00:00');
      expect(normalizeTimeString(undefined)).toBe('00:00:00');
    });

    it('appends :00 to 5-character strings (HH:MM)', () => {
      expect(normalizeTimeString('14:30')).toBe('14:30:00');
    });

    it('returns other strings as-is', () => {
      expect(normalizeTimeString('14:30:45')).toBe('14:30:45');
      expect(normalizeTimeString('invalid')).toBe('invalid');
    });
  });

  // =========================================================================
  // 2. formatTimeLocale
  // =========================================================================
  describe('formatTimeLocale', () => {
    it('returns empty string if timeStr is falsy', () => {
      expect(formatTimeLocale('2023-01-01', null)).toBe('');
    });

    it('returns original string if Date is invalid', () => {
      const result = formatTimeLocale('invalid-date', '14:30');
      expect(result).toBe('14:30');
    });
  });

  // =========================================================================
  // 3. formatTimeRange
  // =========================================================================
  describe('formatTimeRange', () => {

    it('returns null if start is missing', () => {
      expect(formatTimeRange('2023-01-01', null, '15:00')).toBeNull();
    });
  });

  // =========================================================================
  // 4. formatDateLocale
  // =========================================================================
  describe('formatDateLocale', () => {
    it('formats ISO date string correctly', () => {
      const result = formatDateLocale('2024-12-25');
      expect(result).toBe('Dec 25, 2024');
    });
  });

  // =========================================================================
  // 5. formatDateTime
  // =========================================================================
  describe('formatDateTime', () => {

    it('formats date only if time is missing', () => {
      const result = formatDateTime('2024-12-25', null);
      expect(result).toBe('Dec 25, 2024');
    });

    it('returns raw strings if date construction fails', () => {
      const result = formatDateTime('bad-date', '14:30');
      expect(result).toBe('bad-date • 14:30');
    });

    it('returns raw date string if date construction fails and no time provided', () => {
      const result = formatDateTime('bad-date', null);
      expect(result).toBe('bad-date');
    });
  });
});