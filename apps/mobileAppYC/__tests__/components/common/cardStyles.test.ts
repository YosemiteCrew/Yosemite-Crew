import {
  ACTION_WIDTH,
  OVERLAP_WIDTH,
  TOTAL_ACTION_WIDTH,
  getActionWrapperStyle,
  getEditActionButtonStyle,
  getViewActionButtonStyle,
  createCardStyles,
} from '@/shared/components/common/cardStyles.ts';
import {mockTheme} from '../../setup/mockTheme';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((options) => options.ios),
}));

// Mock a theme object matching the structure used in your file


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
          marginBottom: mockTheme.spacing[4],
        })
      );

      // 2. Verify card
      expect(styles.card).toEqual(
        expect.objectContaining({
          borderRadius: mockTheme.borderRadius.lg,
          paddingHorizontal: mockTheme.spacing[4],
          paddingVertical: mockTheme.spacing[4],
          backgroundColor: mockTheme.colors.cardBackground,
          borderWidth: 0,
          borderColor: 'transparent',
        })
      );

      // 3. Verify fallback
      expect(styles.fallback).toEqual(
        expect.objectContaining({
          borderRadius: mockTheme.borderRadius.lg,
          paddingHorizontal: mockTheme.spacing[4],
          paddingVertical: mockTheme.spacing[4],
          backgroundColor: mockTheme.colors.cardBackground,
          borderWidth: 0,
          borderColor: 'transparent',
        })
      );

      // 4. Verify action dimensions
      expect(styles.actionIcon).toEqual(
        expect.objectContaining({
          width: mockTheme.spacing[7],
          height: mockTheme.spacing[7],
          resizeMode: 'contain',
        })
      );

      // 5. Verify typography spreading (title)
      expect(styles.title).toEqual(
        expect.objectContaining({
          fontSize: 18,
          fontWeight: '500',
          lineHeight: 21.6,
          fontFamily: 'ClashGrotesk-Medium',
          letterSpacing: -0.18,
          color: mockTheme.colors.secondary,
        })
      );

      // 6. Verify typography spreading (amount)
      expect(styles.amount).toEqual(
        expect.objectContaining({
          fontSize: 18,
          fontWeight: '500',
          lineHeight: 27,
          fontFamily: 'ClashDisplay-Medium',
          color: mockTheme.colors.secondary,
        })
      );

      // 7. Verify thumbnail container
      expect(styles.thumbnailContainer).toEqual(
        expect.objectContaining({
          width: mockTheme.spacing[14],
          height: mockTheme.spacing[14],
          backgroundColor: mockTheme.colors.primarySurface,
        })
      );
    });
  });
});