import {Platform} from 'react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {
  getInputContainerBaseStyle,
  getInputErrorStyle,
  getInputLabelStyle,
  getValueTextStyle,
} from '@/shared/components/common/shared/floatingLabelStyles';

describe('floatingLabelStyles', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('uses error and default border colors for input containers', () => {
    expect(getInputContainerBaseStyle(mockTheme, 'Required')).toEqual(
      expect.objectContaining({
        borderColor: mockTheme.colors.error,
        backgroundColor: mockTheme.colors.fieldBg,
      }),
    );

    expect(getInputContainerBaseStyle(mockTheme)).toEqual(
      expect.objectContaining({
        borderColor: mockTheme.colors.hairline,
      }),
    );
  });

  it('returns the static label style above the field in dark ink', () => {
    expect(getInputLabelStyle(mockTheme)).toEqual({
      ...mockTheme.typography.inputLabel,
      color: mockTheme.colors.inkBody,
      marginBottom: mockTheme.spacing['2'],
      marginLeft: mockTheme.spacing['1'],
    });
  });

  it('returns the red error message style below the field', () => {
    expect(getInputErrorStyle(mockTheme)).toEqual({
      ...mockTheme.typography.labelXxsBold,
      color: mockTheme.colors.dangerText,
      marginTop: mockTheme.spacing['1'],
      marginBottom: mockTheme.spacing['3'],
      marginLeft: mockTheme.spacing['1'],
    });
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
