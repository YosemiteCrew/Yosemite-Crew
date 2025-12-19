import {
  createGlassCardStyles,
  createCardContentStyles,
  createIconContainerStyles,
  createTextContainerStyles,
} from '@/shared/utils/cardStyles';
import {mockTheme} from '../setup/mockTheme';

// A mock theme to test against


// An empty theme to test fallbacks
const emptyTheme = {};

describe('cardStyles', () => {
  describe('createGlassCardStyles', () => {
    it('should create styles with default config from theme', () => {
      const styles = createGlassCardStyles(mockTheme);
      expect(styles.card).toEqual({
        borderRadius: 16, // from theme.borderRadius.lg
        borderWidth: 1,
        borderColor: 'rgba(234, 234, 234, 0.9)', // from theme.colors.borderMuted
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 4 }, // from theme.shadows.md
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
        shadowColor: 'rgba(71, 56, 39, 0.15)', // from theme.colors.neutralShadow
        padding: 16, // from theme.spacing[4]
      });
      expect(styles.fallback).toEqual({
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderColor: '#EAEAEA', // from theme.colors.border
        overflow: 'hidden',
      });
    });

    it('should create styles with partial custom config', () => {
      const customConfig = {
        borderRadius: 50,
        padding: 100,
      };
      const styles = createGlassCardStyles(mockTheme, customConfig);

      expect(styles.card.borderRadius).toBe(50);
      expect(styles.card.padding).toBe(100);
      expect(styles.card.borderWidth).toBe(1); // Default is preserved
    });

    it('should create styles with hardcoded fallbacks if theme is empty', () => {
      const styles = createGlassCardStyles(emptyTheme);

      expect(styles.card).toEqual({
        borderRadius: 16, // fallback
        borderWidth: 1,
        borderColor: '#EAEAEA', // fallback
        overflow: 'hidden',
        backgroundColor: '#FFFFFF', // fallback
        shadowColor: 'rgba(71, 56, 39, 0.15)', // fallback to neutralShadow
        padding: 16, // fallback
        // No shadow properties, as theme.shadows is undefined
      });
      expect(styles.fallback).toEqual({
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderColor: '#EAEAEA', // fallback uses border
        overflow: 'hidden',
      });
    });
  });

  describe('createCardContentStyles', () => {
    it('should create styles with default gap (3)', () => {
      const styles = createCardContentStyles(mockTheme);
      expect(styles.content).toEqual({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // from theme.spacing[3]
      });
    });

    it('should create styles with a custom gap (1)', () => {
      const styles = createCardContentStyles(mockTheme, 1);
      expect(styles.content.gap).toBe(4); // from theme.spacing[1]
    });

    it('should use calculated fallback gap if theme spacing is missing', () => {
      const styles = createCardContentStyles(emptyTheme, 5);
      expect(styles.content.gap).toBe(20); // 5 * 4
    });
  });

  describe('createIconContainerStyles', () => {
    it('should create styles with defaults (size 48, theme radius)', () => {
      const styles = createIconContainerStyles(mockTheme);
      expect(styles.iconContainer).toEqual({
        width: 48,
        height: 48,
        borderRadius: 8, // from theme.borderRadius.base
        backgroundColor: '#FFFFFF', // from theme.colors.surface
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    it('should create styles with custom size and default radius (size/2)', () => {
      const styles = createIconContainerStyles(mockTheme, 100);
      expect(styles.iconContainer).toEqual({
        width: 100,
        height: 100,
        borderRadius: 8, // from theme.borderRadius.base
        backgroundColor: '#FFFFFF', // from theme.colors.surface
        alignItems: 'center',
        justifyContent: 'center',
      });
    });

    it('should create styles with custom size and custom radius', () => {
      const styles = createIconContainerStyles(mockTheme, 100, 25);
      expect(styles.iconContainer.width).toBe(100);
      expect(styles.iconContainer.height).toBe(100);
      expect(styles.iconContainer.borderRadius).toBe(25);
    });

    it('should use fallbacks if theme is empty', () => {
      const styles = createIconContainerStyles(emptyTheme, 60);
      expect(styles.iconContainer).toEqual({
        width: 60,
        height: 60,
        borderRadius: 30, // fallback to size / 2
        backgroundColor: '#FFFFFF', // fallback
        alignItems: 'center',
        justifyContent: 'center',
      });
    });
  });

  describe('createTextContainerStyles', () => {
    it('should create styles with default gap (1)', () => {
      const styles = createTextContainerStyles(mockTheme);
      expect(styles.textContainer).toEqual({
        flex: 1,
        gap: 4, // from theme.spacing[1]
      });
    });

    it('should create styles with a custom gap (4)', () => {
      const styles = createTextContainerStyles(mockTheme, 4);
      expect(styles.textContainer.gap).toBe(16); // from theme.spacing[4]
    });

    it('should use calculated fallback gap if theme spacing is missing', () => {
      const styles = createTextContainerStyles(emptyTheme, 2);
      expect(styles.textContainer.gap).toBe(8); // 2 * 4
    });
  });
});