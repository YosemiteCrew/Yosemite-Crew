import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {MobilePrescription} from '@/features/companion/services/prescriptionService';
import type {Theme} from '@/theme';

export interface PrescriptionCardProps {
  prescription: MobilePrescription;
  isRequesting: boolean;
  onRequestRefill: (prescriptionId: string) => void;
}

// [accessibility label, visible text] for the refill button.
const REFILL_KEYS = {
  idle: ['prescriptions.requestRefillFor', 'prescriptions.requestRefill'],
  busy: ['prescriptions.requestingFor', 'prescriptions.requesting'],
} as const;

const formatDate = (value: string): string | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  prescription,
  isRequesting,
  onRequestRefill,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation();
  const medication = prescription.items.map(item => item.medication).join(', ');
  const [labelKey, textKey] = REFILL_KEYS[isRequesting ? 'busy' : 'idle'];
  const recordedOn = formatDate(
    prescription.signedAt ?? prescription.createdAt,
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{medication}</Text>
      {prescription.summary ? (
        <Text style={styles.detail}>{prescription.summary}</Text>
      ) : null}
      {prescription.items.map(item => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemTitle}>
            {item.medication}
            {item.strength ? ` · ${item.strength}` : ''}
          </Text>
          <Text style={styles.detail}>
            {[item.dosage, item.route, item.frequency]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.instructions ? (
            <Text style={styles.detail}>{item.instructions}</Text>
          ) : null}
        </View>
      ))}
      {recordedOn ? (
        <Text style={styles.meta}>
          {t('prescriptions.recorded', {date: recordedOn})}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(labelKey, {medication})}
        accessibilityState={{disabled: isRequesting, busy: isRequesting}}
        disabled={isRequesting}
        onPress={() => onRequestRefill(prescription.id)}
        style={[styles.button, isRequesting && styles.buttonDisabled]}>
        <Text style={styles.buttonLabel}>{t(textKey)}</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    title: {...theme.typography.titleSmall, color: theme.colors.text},
    item: {marginTop: theme.spacing['3']},
    itemTitle: {...theme.typography.bodyMedium, color: theme.colors.text},
    detail: {
      ...theme.typography.caption,
      color: theme.colors.inkMuted,
      marginTop: theme.spacing['1'],
    },
    meta: {
      ...theme.typography.caption,
      color: theme.colors.blueText,
      marginTop: theme.spacing['3'],
    },
    button: {
      marginTop: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.blueText,
      alignSelf: 'flex-start',
    },
    buttonDisabled: {opacity: 0.6},
    buttonLabel: {...theme.typography.button, color: theme.colors.white},
  });
