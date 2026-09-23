import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import type {HomeStackParamList} from '@/navigation/types';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  medicalRecordApi,
  type MobileAllergy,
  type MobileProblem,
} from '@/features/companion/services/medicalRecordService';
import type {Theme} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'MedicalRecords'>;

const humanize = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const labelKey = (value: string): string => `medicalRecords.labels.${value}`;

const formatDate = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
};

export const MedicalRecordsScreen: React.FC<Props> = ({navigation, route}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation();
  const {companionId} = route.params;
  const [allergies, setAllergies] = React.useState<MobileAllergy[]>([]);
  const [problems, setProblems] = React.useState<MobileProblem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  // Loading is derived from which request the state belongs to, so a new
  // companion (or a retry) never shows the previous result while it loads.
  const requestKey = `${companionId}:${retryCount}`;
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken)
          throw new Error(t('medicalRecords.signInAgain'));
        const [nextAllergies, nextProblems] = await Promise.all([
          medicalRecordApi.fetchAllergies(companionId, tokens.accessToken),
          medicalRecordApi.fetchProblems(companionId, tokens.accessToken),
        ]);
        if (active) {
          setAllergies(nextAllergies);
          setProblems(nextProblems);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error &&
              loadError.message === t('medicalRecords.signInAgain')
              ? loadError.message
              : t('medicalRecords.loadFailed'),
          );
        }
      } finally {
        if (active) setLoadedKey(requestKey);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [companionId, requestKey, t]);

  const renderAllergy = (allergy: MobileAllergy) => (
    <View key={allergy.id} style={styles.card}>
      <Text style={styles.itemTitle}>{allergy.allergen}</Text>
      <Text style={styles.itemMeta}>
        {t(labelKey(allergy.severity), {
          defaultValue: humanize(allergy.severity),
        })}{' '}
        ·{' '}
        {t(labelKey(allergy.allergyType), {
          defaultValue: humanize(allergy.allergyType),
        })}
        {allergy.status === 'UNCONFIRMED'
          ? ` · ${t('medicalRecords.suspected')}`
          : ''}
      </Text>
      {allergy.reaction ? (
        <Text style={styles.detail}>{allergy.reaction}</Text>
      ) : null}
      {formatDate(allergy.onsetDate) ? (
        <Text style={styles.detail}>
          {t('medicalRecords.since', {date: formatDate(allergy.onsetDate)})}
        </Text>
      ) : null}
    </View>
  );

  const renderProblem = (problem: MobileProblem) => (
    <View key={problem.id} style={styles.card}>
      <Text style={styles.itemTitle}>{problem.name}</Text>
      <Text style={styles.itemMeta}>
        {problem.status === 'INACTIVE'
          ? t('medicalRecords.dormant')
          : t('medicalRecords.active')}
        {problem.severity
          ? ` · ${t(`medicalRecords.problemLabels.${problem.severity}`, {defaultValue: humanize(problem.severity)})}`
          : ''}
      </Text>
      {formatDate(problem.onsetDate) ? (
        <Text style={styles.detail}>
          {t('medicalRecords.since', {date: formatDate(problem.onsetDate)})}
        </Text>
      ) : null}
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <GifLoader />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
          {error !== t('medicalRecords.signInAgain') && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('medicalRecords.retry')}
              onPress={() => setRetryCount(value => value + 1)}
              style={styles.retryButton}>
              <Text style={styles.retryLabel}>{t('medicalRecords.retry')}</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('medicalRecords.intro')}</Text>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t('medicalRecords.allergies')}
        </Text>
        {allergies.length ? (
          allergies.map(renderAllergy)
        ) : (
          <Text style={styles.empty}>{t('medicalRecords.noAllergies')}</Text>
        )}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t('medicalRecords.problems')}
        </Text>
        {problems.length ? (
          problems.map(renderProblem)
        ) : (
          <Text style={styles.empty}>{t('medicalRecords.noProblems')}</Text>
        )}
        <Text style={styles.notice}>{t('medicalRecords.flagsNotice')}</Text>
      </ScrollView>
    );
  };

  return (
    <SafeArea>
      <Header
        title={t('medicalRecords.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      {renderBody()}
    </SafeArea>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {padding: theme.spacing['5'], paddingBottom: theme.spacing['10']},
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing['5'],
    },
    intro: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
      marginBottom: theme.spacing['5'],
    },
    sectionTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
    },
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
    empty: {
      ...theme.typography.body,
      color: theme.colors.inkMuted,
      paddingVertical: theme.spacing['3'],
    },
    notice: {
      ...theme.typography.caption,
      color: theme.colors.inkMuted,
      marginTop: theme.spacing['6'],
    },
    error: {
      ...theme.typography.body,
      color: theme.colors.dangerText,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: theme.spacing['4'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.blueText,
    },
    retryLabel: {...theme.typography.button, color: theme.colors.white},
  });
