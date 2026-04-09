import { formatCompanionNameWithOwnerLastName, getOwnerLastName } from '@/app/lib/companionName';

describe('companionName helpers', () => {
  describe('getOwnerLastName', () => {
    it('returns explicit lastName when provided', () => {
      expect(getOwnerLastName({ firstName: 'Jane', lastName: 'Doe' })).toBe('Doe');
    });

    it('derives last name from full name', () => {
      expect(getOwnerLastName({ name: 'Jane Alice Doe' })).toBe('Doe');
    });

    it('does not use firstName-only values as last name', () => {
      expect(getOwnerLastName({ firstName: 'Jane Doe' })).toBe('');
      expect(getOwnerLastName({ firstName: 'Jane' })).toBe('');
    });

    it('supports string owner names', () => {
      expect(getOwnerLastName('Alex Smith')).toBe('Smith');
    });

    it('requires at least two parts for string full names', () => {
      expect(getOwnerLastName('Alex')).toBe('');
    });

    it('returns empty string for missing owner values', () => {
      expect(getOwnerLastName(undefined)).toBe('');
      expect(getOwnerLastName(null)).toBe('');
      expect(getOwnerLastName({})).toBe('');
    });
  });

  describe('formatCompanionNameWithOwnerLastName', () => {
    it('formats companion name with owner last name', () => {
      expect(formatCompanionNameWithOwnerLastName('Buddy', { lastName: 'Doe' })).toBe(
        'Buddy · Doe'
      );
    });

    it('falls back to companion name when owner last name is unavailable', () => {
      expect(formatCompanionNameWithOwnerLastName('Buddy', { firstName: 'Jane' })).toBe('Buddy');
    });

    it('uses fallback when companion name is missing', () => {
      expect(formatCompanionNameWithOwnerLastName('', { lastName: 'Doe' })).toBe('-');
      expect(formatCompanionNameWithOwnerLastName(undefined, { lastName: 'Doe' }, 'Unknown')).toBe(
        'Unknown'
      );
    });
  });
});
