import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {PrescriptionCard} from '@/features/companion/components/PrescriptionCard';
import {
  usePrescriptions,
  type PrescriptionsLoadError,
  type UsePrescriptionsResult,
} from '@/features/companion/hooks/usePrescriptions';
import type {HomeStackParamList} from '@/navigation/types';
import type {Theme} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Prescriptions'>;

const ERROR_KEY: Record<PrescriptionsLoadError, string> = {
  signIn: 'prescriptions.signInAgain',
  loadFailed: 'prescriptions.loadFailed',
};

export const PrescriptionsScreen: React.FC<Props> = ({navigation, route}) => {
  const {t} = useTranslation();
  const state = usePrescriptions(route.params.companionId);

  return (
    <SafeArea>
      <Header
        title={t('prescriptions.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <PrescriptionsBody {...state} />
    </SafeArea>
  );
};

/** Loading, error, or the list, for the state the hook reports. */
const PrescriptionsBody: React.FC<UsePrescriptionsResult> = ({
  prescriptions,
  loading,
  error,
  reload,
  requestingId,
  requestRefill,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
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
            onPress={reload}
            style={styles.button}>
            <Text style={styles.buttonLabel}>{t('prescriptions.retry')}</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{t('prescriptions.intro')}</Text>
      {prescriptions.length ? (
        prescriptions.map(prescription => (
          <PrescriptionCard
            key={prescription.id}
            prescription={prescription}
            isRequesting={requestingId === prescription.id}
            onRequestRefill={requestRefill}
          />
        ))
      ) : (
        <Text style={styles.empty}>{t('prescriptions.empty')}</Text>
      )}
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
    empty: {...theme.typography.body, color: theme.colors.inkMuted},
    error: {
      ...theme.typography.body,
      color: theme.colors.dangerText,
      textAlign: 'center',
    },
    button: {
      marginTop: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.blueText,
      alignSelf: 'flex-start',
    },
    buttonLabel: {...theme.typography.button, color: theme.colors.white},
  });
