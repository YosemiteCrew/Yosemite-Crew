// src/shared/components/common/ListErrorState/ListErrorState.tsx
//
// The counterpart to EmptyState, for the case that had no UI at all: a list
// whose fetch FAILED. Eight list screens rendered "add your first X" for this,
// so an outage or a dead session read as a new-user onboarding prompt and
// offered no way to try again.
//
// Deliberately built on the same warm-bone shape as EmptyState - a 104pt icon
// ring, serif title, muted body, one pill CTA - so an error looks like part of
// the app rather than a system dialog. The one visual difference is the ring
// colour, which uses the danger surface instead of blue-soft.

import React, {useMemo} from 'react';
import {View, Text, type StyleProp, type ViewStyle} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTranslation} from 'react-i18next';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {createStateBlockStyles} from '@/shared/styles/stateBlockStyles';
import type {Theme} from '@/theme';

export interface ListErrorStateProps {
  /** Overrides the default "We could not load this" title. */
  title?: string;
  /**
   * What failed, in the user's terms. The raw error string from the slice is
   * deliberately NOT the default - "Request failed with status code 401" is
   * not copy.
   */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ListErrorState: React.FC<ListErrorStateProps> = ({
  title,
  description,
  onRetry,
  retryLabel,
  style,
  testID = 'list-error-state',
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedTitle = title ?? t('common.load_failed_title');
  const resolvedDescription = description ?? t('common.load_failed_message');
  const resolvedRetryLabel = retryLabel ?? t('common.try_again');

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={`${resolvedTitle}. ${resolvedDescription}`}
      style={[styles.container, style]}>
      <View style={styles.ring}>
        <Ionicons
          name="cloud-offline-outline"
          size={42}
          color={theme.colors.dangerText}
        />
      </View>
      <Text style={styles.title}>{resolvedTitle}</Text>
      <Text style={styles.description}>{resolvedDescription}</Text>
      {onRetry ? (
        <PressableOpacity
          testID={`${testID}-retry`}
          accessibilityRole="button"
          accessibilityLabel={resolvedRetryLabel}
          onPress={onRetry}
          style={styles.cta}>
          <Ionicons name="refresh" size={18} color={theme.colors.ctaText} />
          <Text style={styles.ctaLabel}>{resolvedRetryLabel}</Text>
        </PressableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  createStateBlockStyles(theme, {
    ringColor: theme.colors.dangerSurface,
    // Errors are dropped inline into a scroll view, so the component carries
    // its own vertical breathing room rather than making every caller pass a
    // layout style.
    paddingVertical: theme.spacing['8'],
  });
