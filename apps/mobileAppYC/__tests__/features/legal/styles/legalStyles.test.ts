import {Platform} from 'react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {createLegalStyles} from '@/features/legal/styles/legalStyles';

describe('createLegalStyles', () => {
  it('builds a stylesheet using the theme colors and spacing', () => {
    const styles = createLegalStyles(mockTheme);

    expect(styles.safeArea.backgroundColor).toBe(mockTheme.colors.background);
    expect(styles.contentContainer.paddingHorizontal).toBe(
      mockTheme.spacing['5'],
    );
    expect(styles.withdrawalCard.gap).toBe(mockTheme.spacing['4']);
  });

  it('uses subtitleBold14/subtitleRegular14 typography values when present on the theme', () => {
    const styles = createLegalStyles(mockTheme);

    expect(styles.formTitle.fontFamily).toBe(
      mockTheme.typography.subtitleBold14.fontFamily,
    );
    expect(styles.formTitle.fontSize).toBe(
      mockTheme.typography.subtitleBold14.fontSize,
    );
    expect(styles.formSubtitle.fontFamily).toBe(
      mockTheme.typography.subtitleRegular14.fontFamily,
    );
  });

  it('falls back to SATOSHI_BOLD/SATOSHI_REGULAR values when subtitle typography is missing', () => {
    const themeWithoutSubtitleTypography = {
      ...mockTheme,
      typography: {
        ...mockTheme.typography,
        subtitleBold14: undefined,
        subtitleRegular14: undefined,
        SATOSHI_BOLD: 'Satoshi-Bold-Fallback',
        SATOSHI_REGULAR: 'Satoshi-Regular-Fallback',
      },
    };

    const styles = createLegalStyles(themeWithoutSubtitleTypography);

    expect(styles.formTitle.fontFamily).toBe('Satoshi-Bold-Fallback');
    expect(styles.formTitle.fontSize).toBe(14);
    expect(styles.formTitle.lineHeight).toBe(14 * 1.2);
    expect(styles.formTitle.fontWeight).toBe('700');

    expect(styles.formSubtitle.fontFamily).toBe('Satoshi-Regular-Fallback');
    expect(styles.formSubtitle.fontSize).toBe(14);
    expect(styles.formSubtitle.fontWeight).toBe('400');

    expect(styles.checkboxLabel.fontFamily).toBe('Satoshi-Regular-Fallback');
    expect(styles.formFooterInline.fontFamily).toBe('Satoshi-Regular-Fallback');
    expect(styles.formFooterInlineBold.fontFamily).toBe(
      'Satoshi-Bold-Fallback',
    );
    expect(styles.formFooterEmail.fontFamily).toBe('Satoshi-Bold-Fallback');
  });

  it('gives withdrawalCardFallback a border on android but not on ios', () => {
    const originalOS = Platform.OS;

    Platform.OS = 'android';
    const androidStyles = createLegalStyles(mockTheme);
    expect(androidStyles.withdrawalCardFallback.borderWidth).toBe(1);

    Platform.OS = 'ios';
    const iosStyles = createLegalStyles(mockTheme);
    expect(iosStyles.withdrawalCardFallback.borderWidth).toBe(0);

    Platform.OS = originalOS;
  });

  it('applies error color and typography to formErrorText', () => {
    const styles = createLegalStyles(mockTheme);
    expect(styles.formErrorText.color).toBe(mockTheme.colors.dangerText);
  });
});
