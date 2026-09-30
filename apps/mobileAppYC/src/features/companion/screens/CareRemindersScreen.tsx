import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  careReminderApi,
  type MobileCareReminder,
} from '@/features/companion/services/careReminderService';
import type {HomeStackParamList} from '@/navigation/types';
import type {Theme} from '@/theme';
import {companionListScreenStyles} from './companionListScreenStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'CareReminders'>;
type LoadError = 'signIn' | 'loadFailed';

const TYPE_KEYS: Record<MobileCareReminder['reminderType'], string> = {
  VACCINATION_BOOSTER: 'careReminders.types.VACCINATION_BOOSTER',
  ANNUAL_CHECKUP: 'careReminders.types.ANNUAL_CHECKUP',
  PARASITE_TREATMENT: 'careReminders.types.PARASITE_TREATMENT',
  DENTAL_CLEANING: 'careReminders.types.DENTAL_CLEANING',
  FOLLOW_UP: 'careReminders.types.FOLLOW_UP',
  CUSTOM: 'careReminders.types.CUSTOM',
};

const reminderTypeKey = (type: string): string =>
  TYPE_KEYS[type as MobileCareReminder['reminderType']] ?? TYPE_KEYS.CUSTOM;

export const CareRemindersScreen: React.FC<Props> = ({navigation, route}) => {
  const {t} = useTranslation();
  const [reminders, setReminders] = useState<MobileCareReminder[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<{
    key: string;
    error: LoadError;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const companionId = route.params.companionId;
  const requestKey = `${companionId}:${attempt}`;
  const loading = loadedKey !== requestKey;
  const error = requestError?.key === requestKey ? requestError.error : null;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken) {
          if (active) setRequestError({key: requestKey, error: 'signIn'});
          return;
        }
        const allReminders = await careReminderApi.list(tokens.accessToken);
        if (active) {
          setReminders(
            allReminders.filter(item => item.patientId === companionId),
          );
        }
      } catch {
        if (active) setRequestError({key: requestKey, error: 'loadFailed'});
      } finally {
        if (active) setLoadedKey(requestKey);
      }
    };

    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attempt, companionId, requestKey]);

  return (
    <SafeArea>
      <Header
        title={t('careReminders.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      <CareRemindersBody
        reminders={reminders}
        loading={loading}
        error={error}
        retry={() => setAttempt(value => value + 1)}
      />
    </SafeArea>
  );
};

const CareRemindersBody: React.FC<{
  reminders: MobileCareReminder[];
  loading: boolean;
  error: LoadError | null;
  retry: () => void;
}> = ({reminders, loading, error, retry}) => {
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
          {t(
            error === 'signIn'
              ? 'careReminders.signInAgain'
              : 'careReminders.loadFailed',
          )}
        </Text>
        {error === 'loadFailed' && (
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.button}>
            <Text style={styles.buttonLabel}>{t('careReminders.retry')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{t('careReminders.intro')}</Text>
      {reminders.length ? (
        reminders.map(reminder => {
          const date = new Date(reminder.dueDate).toLocaleDateString();
          return (
            <View key={reminder.id} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.title} accessibilityRole="header">
                  {t(reminderTypeKey(reminder.reminderType))}
                </Text>
                <Text style={reminder.overdue ? styles.overdue : styles.due}>
                  {t(
                    reminder.overdue
                      ? 'careReminders.overdue'
                      : 'careReminders.due',
                    {date},
                  )}
                </Text>
              </View>
              <Text style={styles.message}>{reminder.message}</Text>
              <Text style={styles.status}>
                {t(
                  reminder.status === 'SENT'
                    ? 'careReminders.sent'
                    : 'careReminders.scheduled',
                )}
              </Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>{t('careReminders.empty')}</Text>
      )}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    ...companionListScreenStyles(theme),
    card: {
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      gap: theme.spacing['2'],
    },
    cardHeading: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
    },
    title: {...theme.typography.bodyBold, color: theme.colors.text, flex: 1},
    overdue: {...theme.typography.caption, color: theme.colors.dangerText},
    due: {...theme.typography.caption, color: theme.colors.blueText},
    message: {...theme.typography.body, color: theme.colors.inkMuted},
    status: {...theme.typography.caption, color: theme.colors.inkMuted},
  });

export default CareRemindersScreen;
