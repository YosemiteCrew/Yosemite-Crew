import {createCommonFormStyles} from '../../src/shared/styles/commonFormStyles';

describe('createCommonFormStyles', () => {
  it('returns correct styles based on the provided theme', () => {
    // Mock theme structure required by the function
    const mockTheme = {
      colors: {
        textSecondary: '#888888',
      },
      spacing: [0, 4, 8, 12, 16, 24], // index 5 is 24
    };

    const styles = createCommonFormStyles(mockTheme);

    expect(styles.dropdownIcon).toEqual({
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: '#888888',
    });

    expect(styles.calendarIcon).toEqual({
      width: 24, // derived from mockTheme.spacing[5]
      height: 24,
      tintColor: '#888888',
    });
  });
});