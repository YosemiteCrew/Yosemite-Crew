import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {AssistantMessage} from '@/features/assistant/types';

interface MessageBubbleProps {
  message: AssistantMessage;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      width: '100%',
      marginBottom: theme.spacing['2'],
    },
    userRow: {alignItems: 'flex-end'},
    assistantRow: {alignItems: 'flex-start'},
    bubble: {
      maxWidth: '86%',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
    },
    userBubble: {
      backgroundColor: theme.colors.blueSoft,
      borderColor: theme.colors.blueSoft,
    },
    assistantBubble: {
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
    },
    text: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
    },
  });

export const MessageBubble: React.FC<MessageBubbleProps> = ({message}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isUser = message.author === 'user';

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View
        testID={`assistant-bubble-${message.author}`}
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}>
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </View>
  );
};
