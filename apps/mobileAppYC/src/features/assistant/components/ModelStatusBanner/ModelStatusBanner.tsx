import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {OnDeviceModelAvailability} from '@/features/assistant/types';

interface ModelStatusBannerProps {
  availability: OnDeviceModelAvailability;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      marginHorizontal: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.cardSmall,
      backgroundColor: theme.colors.infoSurface,
    },
    text: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
  });

/**
 * Explains, once, why answers are phrased plainly on this device.
 *
 * Only shown when the model is genuinely missing. Saying "on-device AI is on"
 * to the majority who have it would be noise, so the available case renders
 * nothing.
 */
export const ModelStatusBanner: React.FC<ModelStatusBannerProps> = ({
  availability,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (availability.available) {
    return null;
  }

  const reasonKey = availability.reason ?? 'unknown';

  return (
    <View style={styles.banner} testID="assistant-model-status">
      <Text style={styles.text}>
        {t(`assistant.model.${reasonKey}`, {
          provider: availability.providerLabel ?? t('assistant.model.provider'),
        })}
      </Text>
    </View>
  );
};
