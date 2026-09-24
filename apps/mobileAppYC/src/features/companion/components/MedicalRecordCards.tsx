import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import type {
  MobileAllergy,
  MobileProblem,
} from '@/features/companion/services/medicalRecordService';
import type {Theme} from '@/theme';

// Readable English for an enum value the catalogue does not have a key for yet.
const humanize = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

/**
 * Allergy and problem severities have separate keys: Spanish agrees the
 * adjective with "la alergia" and "el problema" (Moderada, Moderado).
 */
const useEnumLabel = (group: 'labels' | 'problemLabels') => {
  const {t} = useTranslation();
  return (value: string): string =>
    t(`medicalRecords.${group}.${value}`, {defaultValue: humanize(value)});
};

const useCardStyles = () => {
  const {theme} = useTheme();
  return React.useMemo(() => createStyles(theme), [theme]);
};

/** "Since <date>", or nothing when the onset is missing or unreadable. */
const Onset: React.FC<{value?: string}> = ({value}) => {
  const styles = useCardStyles();
  const {t} = useTranslation();
  const date = formatDate(value);
  return date ? (
    <Text style={styles.detail}>{t('medicalRecords.since', {date})}</Text>
  ) : null;
};

export const AllergyCard: React.FC<{allergy: MobileAllergy}> = ({allergy}) => {
  const styles = useCardStyles();
  const {t} = useTranslation();
  const label = useEnumLabel('labels');
  return (
    <View style={styles.card}>
      <Text style={styles.itemTitle}>{allergy.allergen}</Text>
      <Text style={styles.itemMeta}>
        {label(allergy.severity)} · {label(allergy.allergyType)}
        {allergy.status === 'UNCONFIRMED'
          ? ` · ${t('medicalRecords.suspected')}`
          : ''}
      </Text>
      {allergy.reaction ? (
        <Text style={styles.detail}>{allergy.reaction}</Text>
      ) : null}
      <Onset value={allergy.onsetDate} />
    </View>
  );
};

export const ProblemCard: React.FC<{problem: MobileProblem}> = ({problem}) => {
  const styles = useCardStyles();
  const {t} = useTranslation();
  const label = useEnumLabel('problemLabels');
  const severity = problem.severity ? label(problem.severity) : null;
  return (
    <View style={styles.card}>
      <Text style={styles.itemTitle}>{problem.name}</Text>
      <Text style={styles.itemMeta}>
        {problem.status === 'INACTIVE'
          ? t('medicalRecords.dormant')
          : t('medicalRecords.active')}
        {severity ? ` · ${severity}` : ''}
      </Text>
      <Onset value={problem.onsetDate} />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    itemTitle: {...theme.typography.bodyMedium, color: theme.colors.text},
    itemMeta: {
      ...theme.typography.caption,
      color: theme.colors.blueText,
      marginTop: theme.spacing['1'],
    },
    detail: {
      ...theme.typography.caption,
      color: theme.colors.inkMuted,
      marginTop: theme.spacing['1'],
    },
  });
