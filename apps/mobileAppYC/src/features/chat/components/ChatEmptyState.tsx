/**
 * ChatEmptyState
 *
 * Warm-bone empty state for a conversation with no messages yet. Rendered as the
 * Stream Chat `EmptyStateIndicator` for the appointment channel: a pink
 * companion medallion, a serif "Say hello" title and a supporting line that
 * names the pet the thread is about.
 */

import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

type ChatEmptyStateProps = {
  petName?: string;
};

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({petName}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const subject = petName?.trim() ? petName.trim() : 'your pet';

  return (
    <View style={styles.container} testID="empty-state-indicator">
      <View style={styles.medallion}>
        <Ionicons
          name="chatbubbles-outline"
          size={38}
          color={theme.colors.pink}
        />
      </View>
      <Text style={styles.title}>Say hello</Text>
      <Text style={styles.body}>
        {`Everything about ${subject} stays in this one thread, questions, photos and follow-ups.`}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['11'],
      gap: 6,
    },
    medallion: {
      width: 92,
      height: 92,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.pinkGlow,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing['3'],
    },
    title: {
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    body: {
      ...theme.typography.body14,
      lineHeight: 22,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
  });

export default ChatEmptyState;
