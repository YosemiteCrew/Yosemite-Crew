import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  prescriptionApi,
  type MobilePrescription,
} from '@/features/companion/services/prescriptionService';
import type {HomeStackParamList} from '@/navigation/types';
import type {Theme} from '@/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Prescriptions'>;

const formatDate = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export const PrescriptionsScreen: React.FC<Props> = ({navigation, route}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {t} = useTranslation();
  const [prescriptions, setPrescriptions] = React.useState<
    MobilePrescription[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [requestingId, setRequestingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const tokens = await getFreshStoredTokens();
      if (!tokens?.accessToken) throw new Error(t('prescriptions.signInAgain'));
      const all = await prescriptionApi.list(tokens.accessToken);
      setPrescriptions(
        all.filter(item => item.patientId === route.params.companionId),
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error &&
          loadError.message === t('prescriptions.signInAgain')
          ? loadError.message
          : t('prescriptions.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.companionId, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const requestRefill = async (prescription: MobilePrescription) => {
    try {
      const tokens = await getFreshStoredTokens();
      if (!tokens?.accessToken) throw new Error(t('prescriptions.signInAgain'));
      setRequestingId(prescription.id);
      await prescriptionApi.requestRefill(prescription.id, tokens.accessToken);
      Alert.alert(
        t('prescriptions.refillRequestedTitle'),
        t('prescriptions.refillRequestedBody'),
      );
    } catch (requestError) {
      Alert.alert(
        t('prescriptions.refillFailedTitle'),
        requestError instanceof Error &&
          requestError.message === t('prescriptions.signInAgain')
          ? requestError.message
          : t('prescriptions.refillFailedBody'),
      );
    } finally {
      setRequestingId(null);
    }
  };

  const renderPrescription = (prescription: MobilePrescription) => (
    <View key={prescription.id} style={styles.card}>
      <Text style={styles.title}>
        {prescription.items.map(item => item.medication).join(', ')}
      </Text>
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
      {formatDate(prescription.signedAt ?? prescription.createdAt) ? (
        <Text style={styles.meta}>
          {t('prescriptions.recorded', {
            date: formatDate(prescription.signedAt ?? prescription.createdAt),
          })}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('prescriptions.requestRefill')}
        disabled={requestingId === prescription.id}
        onPress={() => requestRefill(prescription)}
        style={[
          styles.button,
          requestingId === prescription.id && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonLabel}>
          {requestingId === prescription.id
            ? t('prescriptions.requesting')
            : t('prescriptions.requestRefill')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeArea>
      <Header
        title={t('prescriptions.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.centered}>
          <GifLoader />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
          {error !== t('prescriptions.signInAgain') ? (
            <Pressable
              accessibilityRole="button"
              onPress={load}
              style={styles.button}>
              <Text style={styles.buttonLabel}>{t('prescriptions.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t('prescriptions.intro')}</Text>
          {prescriptions.length ? (
            prescriptions.map(renderPrescription)
          ) : (
            <Text style={styles.empty}>{t('prescriptions.empty')}</Text>
          )}
        </ScrollView>
      )}
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
    buttonDisabled: {opacity: 0.6},
    buttonLabel: {...theme.typography.button, color: theme.colors.white},
  });
