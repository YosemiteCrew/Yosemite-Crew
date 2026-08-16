import {createScreenHeaderStyles} from '../../src/shared/styles/screenHeaderStyles';
import {mockTheme} from '../setup/mockTheme';

describe('createScreenHeaderStyles', () => {
  it('returns the header row and circle button styles from the theme', () => {
    const styles = createScreenHeaderStyles(mockTheme);

    expect(styles.header).toEqual({
      flexDirection: 'row',
      alignItems: 'center',
      gap: mockTheme.spacing['3'],
      paddingHorizontal: mockTheme.spacing['5'],
      paddingVertical: mockTheme.spacing['2'],
    });

    expect(styles.circleButton).toEqual({
      width: mockTheme.spacing['10'],
      height: mockTheme.spacing['10'],
      borderRadius: mockTheme.borderRadius.full,
      backgroundColor: mockTheme.colors.screen2,
      borderWidth: 1,
      borderColor: mockTheme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('returns centered title and subtitle text styles without a weight override', () => {
    const styles = createScreenHeaderStyles(mockTheme);

    expect(styles.headerTitleBlock).toEqual({
      flex: 1,
      alignItems: 'center',
    });

    expect(styles.headerTitle).toEqual({
      ...mockTheme.typography.labelSmall,
      fontSize: 15.5,
      letterSpacing: -0.2,
      color: mockTheme.colors.ink,
      textAlign: 'center',
    });

    expect(styles.headerSubtitle).toEqual({
      ...mockTheme.typography.body12,
      color: mockTheme.colors.inkFaint,
      textAlign: 'center',
      marginTop: 1,
    });
  });
});
