import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {
  AllergyCard,
  ProblemCard,
} from '@/features/companion/components/MedicalRecordCards';
import {
  useMedicalRecords,
  type MedicalRecordsLoadError,
  type UseMedicalRecordsResult,
} from '@/features/companion/hooks/useMedicalRecords';
import type {HomeStackParamList} from '@/navigation/types';
import type {Theme} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'MedicalRecords'>;

const ERROR_KEY: Record<MedicalRecordsLoadError, string> = {
  signIn: 'medicalRecords.signInAgain',
  loadFailed: 'medicalRecords.loadFailed',
};

export const MedicalRecordsScreen: React.FC<Props> = ({navigation, route}) => {
  const {t} = useTranslation();
  const state = useMedicalRecords(route.params.companionId);

  return (
    <SafeArea>
      <Header
        title={t('medicalRecords.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <MedicalRecordsBody {...state} />
    </SafeArea>
  );
};

const useScreenStyles = () => {
  const {theme} = useTheme();
  return React.useMemo(() => createStyles(theme), [theme]);
};

/** A section heading, then its cards or the empty-state copy. */
const RecordSection: React.FC<{
  title: string;
  emptyText: string;
  cards: React.ReactNode[];
}> = ({title, emptyText, cards}) => {
  const styles = useScreenStyles();
  return (
    <>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {cards.length ? cards : <Text style={styles.empty}>{emptyText}</Text>}
    </>
  );
};

/** Loading, error, or the records, for the state the hook reports. */
const MedicalRecordsBody: React.FC<UseMedicalRecordsResult> = ({
  allergies,
  problems,
  loading,
  error,
  retry,
}) => {
  const styles = useScreenStyles();
  const {t} = useTranslation();

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
          {t(ERROR_KEY[error])}
        </Text>
        {error === 'loadFailed' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('medicalRecords.retry')}
            onPress={retry}
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
      <RecordSection
        title={t('medicalRecords.allergies')}
        emptyText={t('medicalRecords.noAllergies')}
        cards={allergies.map(allergy => (
          <AllergyCard key={allergy.id} allergy={allergy} />
        ))}
      />
      <RecordSection
        title={t('medicalRecords.problems')}
        emptyText={t('medicalRecords.noProblems')}
        cards={problems.map(problem => (
          <ProblemCard key={problem.id} problem={problem} />
        ))}
      />
      <Text style={styles.notice}>{t('medicalRecords.flagsNotice')}</Text>
    </ScrollView>
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
