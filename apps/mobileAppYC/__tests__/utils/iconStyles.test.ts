import { createIconStyles } from '@/shared/utils/iconStyles';
import {mockTheme} from '../setup/mockTheme';

// Define a mock theme


describe('createIconStyles', () => {
  it('should create the correct icon styles from the theme', () => {
    const styles = createIconStyles(mockTheme);

    expect(styles).toEqual({
      dropdownIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
      },
      calendarIcon: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
      },
      clockIcon: {
        width: 18,
        height: 18,
        resizeMode: 'contain',
      },
      deleteIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: mockTheme.colors.error,
      },
      addIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: mockTheme.colors.secondary,
      },
    });
  });
});