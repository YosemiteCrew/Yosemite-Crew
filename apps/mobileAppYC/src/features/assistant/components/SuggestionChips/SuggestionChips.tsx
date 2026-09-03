import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {ASSISTANT_ACTIONS} from '@/features/assistant/actions/catalogue';

interface SuggestionChipsProps {
  onSelect: (phrase: string) => void;
  /** Cap the number of chips so the row stays scannable. */
  limit?: number;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // A horizontal ScrollView carries no intrinsic height, so inside the
    // screen's flex column it was shrunk by its siblings and clipped the
    // bottom of every pill. It should keep its natural height instead.
    row: {
      flexGrow: 0,
      flexShrink: 0,
    },
    container: {
      paddingHorizontal: theme.spacing['4'],
      gap: theme.spacing['2'],
      paddingBottom: theme.spacing['2'],
    },
    chip: {
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.chip,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
    },
    chipText: {
      ...theme.typography.labelSmall,
      color: theme.colors.text,
    },
  });

/**
 * First-run affordance. An assistant cannot be discovered by guessing, so the
 * catalogue's own sample phrases double as the starter suggestions.
 */
export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  onSelect,
  limit = 4,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const phrases = useMemo(
    () =>
      ASSISTANT_ACTIONS.flatMap(action => action.samplePhraseKeys)
        .slice(0, limit)
        .map(key => ({key, label: t(key)})),
    [limit, t],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.container}
      testID="assistant-suggestions">
      {phrases.map(phrase => (
        <TouchableOpacity
          key={phrase.key}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={phrase.label}
          onPress={() => onSelect(phrase.label)}>
          <Text style={styles.chipText}>{phrase.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
