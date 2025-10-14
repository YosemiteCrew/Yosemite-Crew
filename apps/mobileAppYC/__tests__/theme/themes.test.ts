import {lightTheme, darkTheme} from '@/theme/themes';
import {colors} from '@/theme/colors';
import {typography} from '@/theme/typography';
import {spacing} from '@/theme/spacing';

describe('themes', () => {
  describe('lightTheme', () => {
    it('should have all required properties', () => {
      expect(lightTheme.colors).toBeDefined();
      expect(lightTheme.typography).toBeDefined();
      expect(lightTheme.spacing).toBeDefined();
      expect(lightTheme.borderRadius).toBeDefined();
    });

    it('should map to base color palette', () => {
      expect(lightTheme.colors.primary).toBe(colors.primary);
      expect(lightTheme.colors.secondary).toBe(colors.secondary);
      expect(lightTheme.colors.background).toBe(colors.background);
      expect(lightTheme.colors.surface).toBe(colors.white);
      expect(lightTheme.colors.text).toBe(colors.text);
    });

    it('should use shared typography', () => {
      expect(lightTheme.typography).toBe(typography);
    });

    it('should use shared spacing', () => {
      expect(lightTheme.spacing).toBe(spacing);
    });

    it('should have border radius configuration', () => {
      expect(lightTheme.borderRadius.sm).toBe(4);
      expect(lightTheme.borderRadius.base).toBe(8);
      expect(lightTheme.borderRadius.lg).toBe(16);
      expect(lightTheme.borderRadius.full).toBe(9999);
    });
  });

  describe('darkTheme', () => {
    it('should have all required properties', () => {
      expect(darkTheme.colors).toBeDefined();
      expect(darkTheme.typography).toBeDefined();
      expect(darkTheme.spacing).toBeDefined();
      expect(darkTheme.borderRadius).toBeDefined();
    });

    it('should map to dark color palette', () => {
      expect(darkTheme.colors.primary).toBe(colors.primaryLight);
      expect(darkTheme.colors.secondary).toBe(colors.secondaryLight);
      expect(darkTheme.colors.background).toBe(colors.backgroundDark);
      expect(darkTheme.colors.surface).toBe(colors.gray800);
      expect(darkTheme.colors.text).toBe(colors.textDark);
    });

    it('should use same typography as light theme', () => {
      expect(darkTheme.typography).toBe(typography);
      expect(darkTheme.typography).toBe(lightTheme.typography);
    });

    it('should use same spacing as light theme', () => {
      expect(darkTheme.spacing).toBe(spacing);
      expect(darkTheme.spacing).toBe(lightTheme.spacing);
    });

    it('should have same border radius as light theme', () => {
      expect(darkTheme.borderRadius).toEqual(lightTheme.borderRadius);
    });
  });

  describe('theme consistency', () => {
    it('should have different background colors', () => {
      expect(lightTheme.colors.background).not.toBe(darkTheme.colors.background);
    });

    it('should have different text colors', () => {
      expect(lightTheme.colors.text).not.toBe(darkTheme.colors.text);
    });

    it('can have different primary color across themes', () => {
      expect(lightTheme.colors.primary).not.toBe(darkTheme.colors.primary);
    });

    it('should have same spacing values', () => {
      Object.keys(spacing).forEach(key => {
        expect(lightTheme.spacing[key as keyof typeof spacing]).toBe(darkTheme.spacing[key as keyof typeof spacing]);
      });
    });
  });
});
