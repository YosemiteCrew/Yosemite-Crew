// src/shared/components/common/Badge/Badge.tsx
//
// Warm-bone status badge. A small pill used for appointment / document / task
// statuses. Tones are backed entirely by theme tokens so the badge tracks the
// active (light or espresso) theme with no hard-coded colours.

import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export type BadgeTone =
  'neutral' | 'info' | 'indigo' | 'violet' | 'success' | 'warning' | 'danger';

export type BadgeStatus =
  | 'upcoming'
  | 'requested'
  | 'checkedIn'
  | 'inProgress'
  | 'completed'
  | 'pending'
  | 'cancelled';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Convenience mapping from a domain status to a tone. Overrides `tone`. */
  status?: BadgeStatus;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const STATUS_TONE: Record<BadgeStatus, BadgeTone> = {
  upcoming: 'info',
  requested: 'neutral',
  checkedIn: 'indigo',
  inProgress: 'violet',
  completed: 'success',
  pending: 'warning',
  cancelled: 'danger',
};

interface TonePalette {
  bg: string;
  text: string;
  border: string;
}

const tonePalette = (theme: Theme, tone: BadgeTone): TonePalette => {
  const {colors} = theme;
  switch (tone) {
    case 'info':
      return {bg: colors.blueSoft, text: colors.navActive, border: colors.blue};
    case 'indigo':
      return {
        bg: colors.indigoSurface,
        text: colors.indigo,
        border: colors.indigo,
      };
    case 'violet':
      return {
        bg: colors.violetSurface,
        text: colors.violet,
        border: colors.violet,
      };
    case 'success':
      return {
        bg: colors.successSurface,
        text: colors.success,
        border: colors.success,
      };
    case 'warning':
      return {
        bg: colors.warningSurface,
        text: colors.warning,
        border: colors.warning,
      };
    case 'danger':
      return {
        bg: colors.dangerSurface,
        text: colors.danger,
        border: colors.danger,
      };
    default:
      return {
        bg: colors.screen2,
        text: colors.inkMuted,
        border: colors.hairline,
      };
  }
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  tone = 'neutral',
  status,
  size = 'sm',
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const resolvedTone = status ? STATUS_TONE[status] : tone;
  const palette = useMemo(
    () => tonePalette(theme, resolvedTone),
    [theme, resolvedTone],
  );
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      style={[
        styles.container,
        {backgroundColor: palette.bg, borderColor: palette.border},
        style,
      ]}>
      <Text
        style={[styles.label, {color: palette.text}]}
        numberOfLines={1}
        allowFontScaling>
        {label}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme, size: 'sm' | 'md') =>
  StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: theme.borderRadius.pill,
      paddingHorizontal:
        size === 'sm' ? theme.spacing['2'] : theme.spacing['2.5'],
      paddingVertical: size === 'sm' ? 3 : theme.spacing['1'],
    },
    label: {
      ...theme.typography.eyebrow,
      fontSize: size === 'sm' ? 11 : 12,
      lineHeight: size === 'sm' ? 13 : 14,
      letterSpacing: 0.5,
    },
  });
