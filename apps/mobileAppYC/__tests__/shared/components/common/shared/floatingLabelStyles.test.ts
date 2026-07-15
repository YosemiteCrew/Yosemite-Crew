import {Platform} from 'react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  getInputContainerBaseStyle,
  getValueTextStyle,
  useFloatingLabelAnimatedStyle,
} from '@/shared/components/common/shared/floatingLabelStyles';

describe('floatingLabelStyles', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('builds the focused iOS floating label style with fallback typography values', () => {
    const theme = {
      ...mockTheme,
      typography: {
        ...mockTheme.typography,
        input: {
          ...mockTheme.typography.input,
          lineHeight: undefined,
          fontSize: undefined,
        },
        inputLabel: {
          ...mockTheme.typography.inputLabel,
          lineHeight: undefined,
          fontSize: undefined,
        },
      },
      colors: {
        ...mockTheme.colors,
        surface: '',
      },
    } as typeof mockTheme;

    const style = useFloatingLabelAnimatedStyle({
      animatedValue: {value: 1},
      theme,
      focused: true,
      placeholderOffset: 6,
    });

    expect(style).toEqual(
      expect.objectContaining({
        includeFontPadding: false,
        textAlignVertical: 'center',
        left: mockTheme.spacing['5'],
        color: mockTheme.colors.primary,
        backgroundColor: mockTheme.colors.background,
        paddingHorizontal: mockTheme.spacing['1'],
        pointerEvents: 'none',
      }),
    );
  });

  it('builds the unfocused Android floating label style', () => {
    Platform.OS = 'android';

    const style = useFloatingLabelAnimatedStyle({
      animatedValue: {value: 0},
      theme: mockTheme,
    });

    expect(style).toEqual(
      expect.objectContaining({
        left: mockTheme.spacing['5'],
        color: mockTheme.colors.textSecondary,
        fontSize: mockTheme.typography.input.fontSize,
      }),
    );
    expect(style).not.toHaveProperty('includeFontPadding');
  });

  it('uses error and default border colors for input containers', () => {
    expect(getInputContainerBaseStyle(mockTheme, 'Required')).toEqual(
      expect.objectContaining({
        borderColor: mockTheme.colors.error,
        backgroundColor: mockTheme.colors.surface,
      }),
    );

    expect(getInputContainerBaseStyle(mockTheme)).toEqual(
      expect.objectContaining({
        borderColor: mockTheme.colors.border,
      }),
    );
  });

  it('returns platform-specific value text spacing for filled and empty states', () => {
    const iosFilled = getValueTextStyle(mockTheme, true);
    const iosEmpty = getValueTextStyle(mockTheme, false);

    expect(iosFilled).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.text,
        paddingTop: mockTheme.spacing['2.5'],
        paddingBottom: mockTheme.spacing['2'],
        minHeight: mockTheme.spacing['5'],
      }),
    );
    expect(iosEmpty).toEqual(
      expect.objectContaining({
        color: mockTheme.colors.textSecondary,
        paddingTop: mockTheme.spacing['3'],
        paddingBottom: mockTheme.spacing['3'],
      }),
    );

    Platform.OS = 'android';
    const androidFilled = getValueTextStyle(mockTheme, true);
    const androidEmpty = getValueTextStyle(mockTheme, false);

    expect(androidFilled).toEqual(
      expect.objectContaining({
        paddingTop: mockTheme.spacing['2.5'],
        paddingBottom: mockTheme.spacing['2'],
        minHeight: mockTheme.spacing['6'],
        textAlignVertical: 'center',
      }),
    );
    expect(androidEmpty).toEqual(
      expect.objectContaining({
        paddingTop: mockTheme.spacing['2'],
        color: mockTheme.colors.textSecondary,
      }),
    );
  });
});
