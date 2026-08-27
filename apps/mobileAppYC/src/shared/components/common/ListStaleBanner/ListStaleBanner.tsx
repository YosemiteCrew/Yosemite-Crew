// src/shared/components/common/ListStaleBanner/ListStaleBanner.tsx
//
// Shown ALONGSIDE content, never instead of it: the last refresh failed but the
// list underneath is still readable and still worth reading. Promoting the
// error over that content is the thing `resolveListPhase` deliberately refuses
// to do; this is the affordance that makes the refusal honest, by saying the
// content may be out of date and offering a way to try again.
//
// Deliberately NOT shaped like ListErrorState. That component owns an empty
// content area and can afford a 104pt ring and a pill CTA. This one sits on top
// of a list the user is trying to read, so it is a single slim row: it has to
// be noticeable without being in the way.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTranslation} from 'react-i18next';

import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {describeStaleness} from '@/shared/utils/staleness';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export interface ListStaleBannerProps {
  /** Epoch ms of the last successful fetch, if there has ever been one. */
  lastLoadedAt?: number;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ListStaleBanner: React.FC<ListStaleBannerProps> = ({
  lastLoadedAt,
  onRetry,
  style,
  testID = 'list-stale-banner',
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const {key, count} = describeStaleness(lastLoadedAt);
  const title = t('common.stale_title');
  const age = t(key, {count});
  const retryLabel = t('common.try_again');

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${age}`}
      style={[styles.container, style]}>
      <Ionicons
        name="time-outline"
        size={18}
        color={theme.colors.dangerText}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.age}>{age}</Text>
      </View>
      {onRetry ? (
        <PressableOpacity
          testID={`${testID}-retry`}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={styles.retry}>
          <Text style={styles.retryLabel}>{retryLabel}</Text>
        </PressableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      backgroundColor: theme.colors.dangerSurface,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
    },
    icon: {
      marginTop: 1,
    },
    copy: {
      flex: 1,
    },
    title: {
      ...theme.typography.bodySmall,
      fontSize: 14,
      color: theme.colors.ink,
    },
    age: {
      ...theme.typography.bodySmall,
      fontSize: 12.5,
      color: theme.colors.inkMuted,
    },
    retry: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['3'],
    },
    retryLabel: {
      ...theme.typography.button,
      fontSize: 14,
      color: theme.colors.dangerText,
    },
  });
