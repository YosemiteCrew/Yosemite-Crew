import { createIconStyles } from '@/shared/utils/iconStyles';

// Define a mock theme
const mockTheme = {
  colors: {
    error: '#FF0000',
    secondary: '#555555',
  },
};

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
        tintColor: '#FF0000', // from theme.colors.error
      },
      addIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: '#555555', // from theme.colors.secondary
      },
    });
  });
});