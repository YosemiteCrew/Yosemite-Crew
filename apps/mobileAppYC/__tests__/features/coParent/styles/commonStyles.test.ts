import {createCommonCoParentStyles} from '../../../../src/features/coParent/styles/commonStyles';

describe('createCommonCoParentStyles', () => {
  const mockTheme = {
    colors: {
      background: '#FFFFFF',
      secondary: '#0000FF',
      borderMuted: '#CCCCCC',
      white: '#FFFFFF',
    },
    borderRadius: {
      lg: 12,
    },
    typography: {
      titleMedium: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
  };

  it('returns the correct styles based on the provided theme', () => {
    const styles = createCommonCoParentStyles(mockTheme);

    expect(styles).toEqual({
      container: {
        flex: 1,
        backgroundColor: mockTheme.colors.background,
      },
      button: {
        width: '100%',
        backgroundColor: mockTheme.colors.secondary,
        borderRadius: mockTheme.borderRadius.lg,
        borderWidth: 1,
        borderColor: mockTheme.colors.borderMuted,
        shadowColor: '#000000',
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
      },
      buttonText: {
        color: mockTheme.colors.white,
        fontSize: 16,
        fontWeight: 'bold',
      },
      centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
    });
  });
});