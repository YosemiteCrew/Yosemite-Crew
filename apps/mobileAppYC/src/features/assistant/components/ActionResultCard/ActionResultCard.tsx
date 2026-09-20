import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {AssistantActionResult} from '@/features/assistant/types';

interface ActionResultCardProps {
  result: AssistantActionResult;
  /** Invoked for a handoff result. The screen owns the navigation. */
  onOpen: (deepLink: string) => void;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['3'],
      padding: theme.spacing['4'],
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      alignSelf: 'flex-start',
      maxWidth: '90%',
    },
    item: {
      paddingVertical: theme.spacing['2'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    firstItem: {borderTopWidth: 0},
    itemTitle: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.text,
    },
    itemSubtitle: {
      ...theme.typography.labelXs,
      color: theme.colors.textSecondary,
    },
    action: {
      marginTop: theme.spacing['3'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
      alignSelf: 'flex-start',
    },
    actionText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.ctaText,
    },
  });

/**
 * The structured half of an answer.
 *
 * The bubble above it already carries the sentence, so this renders only what
 * a sentence reads badly: a list of due items, and the button for a handoff
 * the assistant deliberately did not complete on its own.
 */
export const ActionResultCard: React.FC<ActionResultCardProps> = ({
  result,
  onOpen,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const items = result.data?.items ?? [];
  const hasHandoff = result.status === 'handoff' && Boolean(result.deepLink);

  if (items.length === 0 && !hasHandoff) {
    return null;
  }

  return (
    <View style={styles.card} testID="assistant-result-card">
      {items.map((item, index) => (
        <View
          key={item.id}
          style={[styles.item, index === 0 && styles.firstItem]}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.subtitle ? (
            <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
          ) : null}
        </View>
      ))}

      {hasHandoff ? (
        <PressableOpacity
          style={styles.action}
          accessibilityRole="button"
          testID="assistant-result-open"
          onPress={() => onOpen(result.deepLink as string)}>
          <Text style={styles.actionText}>
            {t(`assistant.open.${result.actionId}`)}
          </Text>
        </PressableOpacity>
      ) : null}
    </View>
  );
};
