// src/features/payments/components/PaymentsEmptyState/PaymentsEmptyState.tsx
//
// Warm-bone "nothing due" payments empty state: a 104pt green-tinted medallion
// with a checkmark-done glyph to signal "all clear", a Newsreader serif title,
// muted body copy and an optional tertiary text link (soft action, not a filled
// CTA). Copy and icon are passed in so the component stays i18n-agnostic and
// reusable wherever a "no invoices / payments" condition renders.

import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export interface PaymentsEmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const PaymentsEmptyState: React.FC<PaymentsEmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showAction = Boolean(actionLabel && onAction);

  return (
    <View testID={testID} style={[styles.container, style]}>
      <View style={styles.ring}>
        {icon ?? (
          <Ionicons
            name="checkmark-done-outline"
            size={42}
            color={theme.colors.success}
          />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {showAction ? (
        <PressableOpacity
          testID={testID ? `${testID}-action` : undefined}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={styles.action}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={theme.colors.blueText}
          />
        </PressableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['10'],
      paddingVertical: theme.spacing['12'],
    },
    ring: {
      width: 104,
      height: 104,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.avatarGreenBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['3.5'],
    },
    title: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    description: {
      ...theme.typography.bodySmall,
      fontSize: 14.5,
      lineHeight: 22.5,
      color: theme.colors.inkMuted,
      textAlign: 'center',
      marginTop: theme.spacing['1.25'],
    },
    action: {
      minHeight: theme.spacing['12'],
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['1.25'],
      marginTop: theme.spacing['2.5'],
    },
    actionLabel: {
      ...theme.typography.button,
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.blueText,
    },
  });
