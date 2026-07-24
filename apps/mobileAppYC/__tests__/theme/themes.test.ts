import {lightTheme, darkTheme} from '@/theme/themes';
import {colors, colorsDark} from '@/theme/colors';
import {typography} from '@/theme/typography';
import {spacing} from '@/theme/spacing';

describe('themes', () => {
  describe('lightTheme', () => {
    it('should have all required properties', () => {
      expect(lightTheme.colors).toBeDefined();
      expect(lightTheme.typography).toBeDefined();
      expect(lightTheme.spacing).toBeDefined();
      expect(lightTheme.borderRadius).toBeDefined();
      expect(lightTheme.shadows).toBeDefined();
    });

    it('should map to the warm-bone light palette', () => {
      expect(lightTheme.colors).toBe(colors);
      expect(lightTheme.colors.primary).toBe(colors.primary);
      expect(lightTheme.colors.secondary).toBe(colors.secondary);
      expect(lightTheme.colors.background).toBe(colors.background);
      expect(lightTheme.colors.surface).toBe(colors.surface);
      expect(lightTheme.colors.text).toBe(colors.text);
    });

    it('should use shared typography', () => {
      expect(lightTheme.typography).toBe(typography);
    });

    it('should use shared spacing', () => {
      expect(lightTheme.spacing).toBe(spacing);
    });

    it('should keep the numeric radius scale stable and add semantic radii', () => {
      expect(lightTheme.borderRadius.sm).toBe(16);
      expect(lightTheme.borderRadius.base).toBe(16);
      expect(lightTheme.borderRadius.lg).toBe(16);
      expect(lightTheme.borderRadius.full).toBe(9999);
      expect(lightTheme.borderRadius.card).toBe(20);
      expect(lightTheme.borderRadius.button).toBe(18);
      expect(lightTheme.borderRadius.screen).toBe(28);
      expect(lightTheme.borderRadius.field).toBe(16);
    });
  });

  describe('darkTheme', () => {
    it('should have all required properties', () => {
      expect(darkTheme.colors).toBeDefined();
      expect(darkTheme.typography).toBeDefined();
      expect(darkTheme.spacing).toBeDefined();
      expect(darkTheme.borderRadius).toBeDefined();
      expect(darkTheme.shadows).toBeDefined();
    });

    it('should map to the espresso dark palette', () => {
      expect(darkTheme.colors).toBe(colorsDark);
      expect(darkTheme.colors.background).toBe(colorsDark.background);
      expect(darkTheme.colors.surface).toBe(colorsDark.surface);
      expect(darkTheme.colors.text).toBe(colorsDark.text);
      expect(darkTheme.colors.cta).toBe(colorsDark.cta);
    });

    it('should use the same typography and spacing as light theme', () => {
      expect(darkTheme.typography).toBe(typography);
      expect(darkTheme.typography).toBe(lightTheme.typography);
      expect(darkTheme.spacing).toBe(spacing);
      expect(darkTheme.spacing).toBe(lightTheme.spacing);
    });

    it('should have the same border radius as light theme', () => {
      expect(darkTheme.borderRadius).toEqual(lightTheme.borderRadius);
    });
  });

  describe('theme consistency', () => {
    it('should have different surface / background colors', () => {
      expect(lightTheme.colors.background).not.toBe(
        darkTheme.colors.background,
      );
      expect(lightTheme.colors.surface).not.toBe(darkTheme.colors.surface);
    });

    it('should have different text colors', () => {
      expect(lightTheme.colors.text).not.toBe(darkTheme.colors.text);
      expect(lightTheme.colors.ink).not.toBe(darkTheme.colors.ink);
    });

    it('keeps the blue interaction fill identical across themes', () => {
      expect(lightTheme.colors.blue).toBe(darkTheme.colors.blue);
      expect(lightTheme.colors.pink).toBe(darkTheme.colors.pink);
    });

    it('inverts the primary CTA fill between themes', () => {
      expect(lightTheme.colors.cta).not.toBe(darkTheme.colors.cta);
      expect(lightTheme.colors.ctaText).not.toBe(darkTheme.colors.ctaText);
    });

    it('should have same spacing values', () => {
      Object.keys(spacing).forEach(key => {
        expect(lightTheme.spacing[key as keyof typeof spacing]).toBe(
          darkTheme.spacing[key as keyof typeof spacing],
        );
      });
    });
  });
});
