import {createCommonFormStyles} from '../../src/shared/styles/commonFormStyles';
import {mockTheme} from '../setup/mockTheme';

describe('createCommonFormStyles', () => {
  it('returns correct styles based on the provided theme', () => {
    // Mock theme structure required by the function


    const styles = createCommonFormStyles(mockTheme);

    expect(styles.dropdownIcon).toEqual({
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: mockTheme.colors.textSecondary,
    });

    expect(styles.calendarIcon).toEqual({
      width: 20, // derived from mockTheme.spacing[5]
      height: 20,
      tintColor: mockTheme.colors.textSecondary,
    });
  });
});