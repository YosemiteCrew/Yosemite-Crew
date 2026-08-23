// Shared style helpers for the warm-bone text/touchable inputs: the field
// container (border, radius, warm fieldBg) and the value text. The label now
// sits statically above the field, so no animated floating-label helper remains.

import {Platform} from 'react-native';
import type {TextStyle} from 'react-native';
import type {Theme} from '@/theme/themes';

export const getInputContainerBaseStyle = (theme: Theme, error?: string) => ({
  borderWidth: 1.5,
  borderColor: error ? theme.colors.error : theme.colors.controlBorder,
  borderRadius: theme.borderRadius.field,
  backgroundColor: theme.colors.fieldBg,
  paddingHorizontal: theme.spacing['5'],
  minHeight: theme.spacing['14'],
  position: 'relative' as const,
  justifyContent: 'center' as const,
});

// Static label sits above the field in dark ink; the error is carried by the
// red field border and the red message below (matching the design).
export const getInputLabelStyle = (theme: Theme): TextStyle => ({
  ...theme.typography.inputLabel,
  color: theme.colors.inkBody,
  marginBottom: theme.spacing['2'],
  marginLeft: theme.spacing['1'],
});

export const getInputErrorStyle = (theme: Theme): TextStyle => ({
  ...theme.typography.labelXxsBold,
  color: theme.colors.dangerText,
  marginTop: theme.spacing['1'],
  marginBottom: theme.spacing['3'],
  marginLeft: theme.spacing['1'],
});

export const getValueTextStyle = (
  theme: Theme,
  hasValue: boolean,
): TextStyle => ({
  ...(hasValue ? theme.typography.inputFilled : theme.typography.input),
  color: hasValue ? theme.colors.text : theme.colors.textSecondary,
  fontSize: theme.typography.input.fontSize,
  lineHeight: theme.spacing['5'],
  flex: 1,
  ...(Platform.OS === 'ios'
    ? {
        paddingTop: hasValue ? theme.spacing['2.5'] : theme.spacing['3'],
        paddingBottom: hasValue ? theme.spacing['2'] : theme.spacing['3'],
      }
    : {
        paddingTop: hasValue ? theme.spacing['2.5'] : theme.spacing['2'],
        paddingBottom: theme.spacing['2'],
        textAlignVertical: 'center' as const,
      }),
  paddingHorizontal: 0,
  margin: 0,
  minHeight: Platform.OS === 'ios' ? theme.spacing['5'] : theme.spacing['6'],
});
