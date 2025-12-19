import {createCommonCoParentStyles} from '../../../../src/features/coParent/styles/commonStyles';
import {mockTheme} from '../../../setup/mockTheme';

describe('createCommonCoParentStyles', () => {
  

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
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 8,
      },
      buttonText: expect.objectContaining({
        color: mockTheme.colors.white,
        fontSize: 18,
        fontWeight: '500',
        lineHeight: 21.6,
        fontFamily: 'ClashGrotesk-Medium',
        letterSpacing: -0.18,
      }),
      centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
    });
  });
});