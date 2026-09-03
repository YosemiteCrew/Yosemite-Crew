import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {MAX_UTTERANCE_LENGTH} from '@/features/assistant/constants';

interface AssistantComposerProps {
  onSubmit: (text: string) => void;
  busy: boolean;
  /** Lets the screen push a suggestion chip into the field. */
  value: string;
  onChangeText: (text: string) => void;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing['2'],
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['3'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.field,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.fieldBg,
      ...theme.typography.input,
      color: theme.colors.text,
    },
    send: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
    },
    sendDisabled: {opacity: 0.5},
    sendText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.ctaText,
    },
  });

export const AssistantComposer: React.FC<AssistantComposerProps> = ({
  onSubmit,
  busy,
  value,
  onChangeText,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);

  const canSend = value.trim().length > 0 && !busy;

  const handleSubmit = useCallback(() => {
    if (!canSend) {
      return;
    }
    onSubmit(value.trim());
  }, [canSend, onSubmit, value]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        testID="assistant-input"
        style={[styles.input, focused && {borderColor: theme.colors.primary}]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('assistant.composerPlaceholder')}
        placeholderTextColor={theme.colors.textSecondary}
        maxLength={MAX_UTTERANCE_LENGTH}
        multiline
        accessibilityLabel={t('assistant.composerPlaceholder')}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        blurOnSubmit
      />
      <TouchableOpacity
        testID="assistant-send"
        accessibilityRole="button"
        accessibilityLabel={t('assistant.send')}
        accessibilityState={{disabled: !canSend}}
        disabled={!canSend}
        style={[styles.send, !canSend && styles.sendDisabled]}
        onPress={handleSubmit}>
        {busy ? (
          <ActivityIndicator
            testID="assistant-busy"
            color={theme.colors.ctaText}
          />
        ) : (
          <Text style={styles.sendText}>{t('assistant.send')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};
