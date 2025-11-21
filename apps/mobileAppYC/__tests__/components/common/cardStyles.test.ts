import {
  ACTION_WIDTH,
  OVERLAP_WIDTH,
  TOTAL_ACTION_WIDTH,
  getActionWrapperStyle,
  getEditActionButtonStyle,
  getViewActionButtonStyle,
  createCardStyles,
} from '@/shared/components/common/cardStyles.ts';

// Mock a theme object matching the structure used in your file
const mockTheme = {
  colors: {
    primary: '#007AFF',
    success: '#34C759',
    surface: '#FFFFFF',
    borderMuted: '#E5E5EA',
    secondary: '#000000',
    primarySurface: '#F2F2F7',
  },
  borderRadius: {
    lg: 12,
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
  },
  typography: {
    titleMedium: {
      fontSize: 16,
      fontWeight: '600',
    },
    h5: {
      fontSize: 20,
      fontWeight: '700',
    },
  },
};

describe('cardStyles', () => {
  describe('Constants', () => {
    it('exports the correct constant values', () => {
      expect(ACTION_WIDTH).toBe(65);
      expect(OVERLAP_WIDTH).toBe(12);
      expect(TOTAL_ACTION_WIDTH).toBe(130); // 65 * 2
    });
  });

  describe('Helper Functions', () => {
    it('getActionWrapperStyle returns correct dynamic styles', () => {
      const style = getActionWrapperStyle(true, mockTheme);

      expect(style).toEqual({
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        backgroundColor: mockTheme.colors.primary,
        borderTopRightRadius: mockTheme.borderRadius.lg,
        borderBottomRightRadius: mockTheme.borderRadius.lg,
        overflow: 'hidden',
      });
    });

    it('getEditActionButtonStyle returns correct styles', () => {
      const style = getEditActionButtonStyle(mockTheme);
      expect(style).toEqual({
        backgroundColor: mockTheme.colors.primary,
      });
    });

    it('getViewActionButtonStyle returns correct styles', () => {
      const style = getViewActionButtonStyle(mockTheme);
      expect(style).toEqual({
        backgroundColor: mockTheme.colors.success,
        borderTopRightRadius: mockTheme.borderRadius.lg,
        borderBottomRightRadius: mockTheme.borderRadius.lg,
      });
    });
  });

  describe('createCardStyles', () => {
    it('generates the stylesheet using the provided theme', () => {
      const styles = createCardStyles(mockTheme);

      // 1. Verify container
      expect(styles.container).toEqual(
        expect.objectContaining({
          width: '100%',
          alignSelf: 'center',
          marginBottom: mockTheme.spacing[3],
        })
      );

      // 2. Verify card
      expect(styles.card).toEqual(
        expect.objectContaining({
          borderRadius: mockTheme.borderRadius.lg,
          paddingHorizontal: mockTheme.spacing[4],
          backgroundColor: mockTheme.colors.surface,
          borderColor: mockTheme.colors.borderMuted,
        })
      );

      // 3. Verify fallback
      expect(styles.fallback).toEqual(
        expect.objectContaining({
          borderRadius: mockTheme.borderRadius.lg,
          backgroundColor: mockTheme.colors.surface,
          borderColor: mockTheme.colors.borderMuted,
        })
      );

      // 4. Verify action dimensions
      expect(styles.actionIcon).toEqual(
        expect.objectContaining({
          width: 30,
          height: 30,
          resizeMode: 'contain',
        })
      );

      // 5. Verify typography spreading (title)
      expect(styles.title).toEqual(
        expect.objectContaining({
          fontSize: 16,
          fontWeight: '600',
          color: mockTheme.colors.secondary,
        })
      );

      // 6. Verify typography spreading (amount)
      expect(styles.amount).toEqual(
        expect.objectContaining({
          fontSize: 20,
          fontWeight: '700',
          color: mockTheme.colors.secondary,
        })
      );

      // 7. Verify thumbnail container
      expect(styles.thumbnailContainer).toEqual(
        expect.objectContaining({
          width: 54,
          height: 54,
          backgroundColor: mockTheme.colors.primarySurface,
        })
      );
    });
  });
});