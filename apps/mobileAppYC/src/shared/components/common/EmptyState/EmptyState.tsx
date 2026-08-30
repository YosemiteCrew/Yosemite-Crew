// src/shared/components/common/EmptyState/EmptyState.tsx
//
// Warm-bone empty state: a 104pt blue-soft icon ring, a Newsreader serif title,
// muted body copy and an optional primary CTA. Copy and icon are passed in so
// the component stays i18n-agnostic and reusable across features.

import React, {useMemo} from 'react';
import {View, Text, type StyleProp, type ViewStyle} from 'react-native';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {createStateBlockStyles} from '@/shared/styles/stateBlockStyles';
import type {Theme} from '@/theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  actionIcon,
  onAction,
  style,
  testID,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showAction = Boolean(actionLabel && onAction);

  return (
    <View testID={testID} style={[styles.container, style]}>
      <View style={styles.ring}>{icon}</View>
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
          style={styles.cta}>
          {actionIcon}
          <Text style={styles.ctaLabel}>{actionLabel}</Text>
        </PressableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  createStateBlockStyles(theme, {ringColor: theme.colors.blueSoft});
