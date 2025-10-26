import {
  formatDate,
  formatDateShort,
  calculateAge,
  calculateAgeFromDateOfBirth,
  capitalize,
  formatWeight,
  generateAvatarUrl,
} from '@/utils/helpers';

describe('helpers utilities', () => {
  describe('formatDate', () => {
    it('should format date object correctly', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toContain('January');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date string correctly', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('January');
    });
  });

  describe('formatDateShort', () => {
    it('should format date in short format', () => {
      const date = new Date('2024-01-15');
      const result = formatDateShort(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });

  describe('calculateAge', () => {
    it('should calculate age correctly', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 25);
      const age = calculateAge(birthDate);
      expect(age).toBe(25);
    });

    it('should handle string birth dates', () => {
      const birthDate = '1990-01-01';
      const age = calculateAge(birthDate);
      expect(age).toBeGreaterThanOrEqual(34);
    });

    it('should handle birthday not yet occurred this year', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth() + 1, 1);
      const age = calculateAge(birthDate);
      expect(age).toBe(24);
    });

    it('should handle same month but earlier day', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate() + 1);
      const age = calculateAge(birthDate);
      expect(age).toBe(24);
    });
  });

  describe('calculateAgeFromDateOfBirth', () => {
    it('should calculate age correctly from Date object', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 25);
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBe(25);
    });

    it('should calculate age correctly from string', () => {
      const birthDate = '1990-01-01';
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBeGreaterThanOrEqual(34);
    });

    it('should handle birthday not yet occurred this year', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth() + 1, 1);
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBe(24);
    });

    it('should handle same month but earlier day', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate() + 1);
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBe(24);
    });

    it('should return 0 for future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const age = calculateAgeFromDateOfBirth(futureDate);
      expect(age).toBe(0);
    });

    it('should handle age 0 (born this year)', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear(), 0, 1);
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBeGreaterThanOrEqual(0);
    });

    it('should handle exact birthday today', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      const age = calculateAgeFromDateOfBirth(birthDate);
      expect(age).toBe(25);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('HELLO')).toBe('Hello');
    });
  });

  describe('formatWeight', () => {
    it('should format weight in kg', () => {
      expect(formatWeight(70)).toBe('70 kg');
    });

    it('should format weight in lbs', () => {
      expect(formatWeight(150, 'lbs')).toBe('150 lbs');
    });
  });

  describe('generateAvatarUrl', () => {
    it('should generate avatar URL with seed', () => {
      const url = generateAvatarUrl('test-seed');
      expect(url).toContain('picsum.photos');
      expect(url).toContain('seed=test-seed');
    });

    it('should generate random avatar URL without seed', () => {
      const url = generateAvatarUrl();
      expect(url).toContain('picsum.photos');
      expect(url).toContain('random=');
    });
  });
});
