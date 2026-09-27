import React from 'react';
import {Alert, StyleSheet, Text, TextInput, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';
import type {AppDispatch, RootState} from '@/app/store';
import type {Theme} from '@/theme';
import {useTheme} from '@/hooks';
import {Checkbox} from '@/shared/components/common/Checkbox/Checkbox';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {saveVisitPreparationDraft} from '../appointmentsSlice';
import type {VisitPreparationDraft} from '../types';
import {
  captureVisitVoice,
  isVisitVoiceAvailable,
  readVisitText,
  stopReadingVisitText,
} from '../services/visitVoice';

const EMPTY_DRAFT: VisitPreparationDraft = {
  observations: '',
  questions: '',
  includeObservations: true,
  includeQuestions: true,
};

export const composeVisitPreparationMessage = (
  draft: VisitPreparationDraft,
  observationLabel: string,
  questionLabel: string,
): string => {
  const sections: string[] = [];
  const observations = draft.observations.trim();
  const questions = draft.questions.trim();
  if (draft.includeObservations && observations) {
    sections.push(`${observationLabel}\n${observations}`);
  }
  if (draft.includeQuestions && questions) {
    sections.push(`${questionLabel}\n${questions}`);
  }
  return sections.join('\n\n');
};

type DraftField = 'observations' | 'questions';

export const VisitPreparationDraftCard: React.FC<{
  appointmentId: string;
  onReviewInChat: (message: string) => void;
}> = ({appointmentId, onReviewInChat}) => {
  const {t, i18n} = useTranslation();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const storedDraft = useSelector(
    (state: RootState) =>
      state.appointments.visitPreparationDrafts?.[appointmentId],
  );
  const draft = storedDraft ?? EMPTY_DRAFT;
  const [voiceAvailable, setVoiceAvailable] = React.useState<boolean | null>(
    null,
  );
  const [listeningField, setListeningField] = React.useState<DraftField | null>(
    null,
  );
  const [isReading, setIsReading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    isVisitVoiceAvailable().then(available => {
      if (active) setVoiceAvailable(available);
    });
    return () => {
      active = false;
      stopReadingVisitText().catch(() => undefined);
    };
  }, []);

  const updateDraft = React.useCallback(
    (changes: Partial<VisitPreparationDraft>) => {
      dispatch(
        saveVisitPreparationDraft({
          appointmentId,
          draft: {...draft, ...changes},
        }),
      );
    },
    [appointmentId, dispatch, draft],
  );

  const message = composeVisitPreparationMessage(
    draft,
    t('appointments.visitPreparation.observationsHeading'),
    t('appointments.visitPreparation.questionsHeading'),
  );

  const capture = async (field: DraftField) => {
    setListeningField(field);
    const result = await captureVisitVoice(i18n.resolvedLanguage ?? 'en-US');
    setListeningField(null);
    if (result.status === 'ok') {
      const current = draft[field].trim();
      updateDraft({
        [field]: current ? `${current} ${result.text}` : result.text,
      });
      return;
    }
    const bodyKey =
      result.status === 'denied'
        ? 'appointments.visitPreparation.voicePermissionDenied'
        : result.status === 'unavailable'
          ? 'appointments.visitPreparation.voiceUnavailable'
          : 'appointments.visitPreparation.voiceFailed';
    Alert.alert(t('appointments.visitPreparation.voiceErrorTitle'), t(bodyKey));
  };

  const toggleReadBack = async () => {
    if (isReading) {
      await stopReadingVisitText();
      setIsReading(false);
      return;
    }
    const started = await readVisitText(
      message,
      i18n.resolvedLanguage ?? 'en-US',
    );
    setIsReading(started);
    if (!started) {
      Alert.alert(
        t('appointments.visitPreparation.voiceErrorTitle'),
        t('appointments.visitPreparation.readBackFailed'),
      );
    }
  };

  const renderField = (
    field: DraftField,
    includeField: 'includeObservations' | 'includeQuestions',
  ) => (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>
          {t(`appointments.visitPreparation.${field}`)}
        </Text>
        {voiceAvailable ? (
          <PressableOpacity
            testID={`visit-voice-${field}`}
            onPress={() => {
              capture(field);
            }}
            disabled={listeningField !== null}
            accessibilityRole="button"
            accessibilityLabel={t('appointments.visitPreparation.speakFor', {
              field: t(`appointments.visitPreparation.${field}`),
            })}
            accessibilityState={{disabled: listeningField !== null}}
            style={styles.iconButton}>
            <Ionicons
              name={listeningField === field ? 'mic' : 'mic-outline'}
              size={20}
              color={theme.colors.blueText}
            />
          </PressableOpacity>
        ) : null}
      </View>
      <TextInput
        testID={`visit-${field}-input`}
        value={draft[field]}
        onChangeText={value => updateDraft({[field]: value})}
        multiline
        textAlignVertical="top"
        placeholder={t(`appointments.visitPreparation.${field}Placeholder`)}
        placeholderTextColor={theme.colors.inkFaint}
        style={styles.input}
        accessibilityLabel={t(`appointments.visitPreparation.${field}`)}
      />
      <Checkbox
        value={draft[includeField]}
        onValueChange={value => updateDraft({[includeField]: value})}
        label={t('appointments.visitPreparation.includeWhenSending')}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('appointments.visitPreparation.notesTitle')}
      </Text>
      <Text style={styles.description}>
        {t('appointments.visitPreparation.notesDescription')}
      </Text>
      {voiceAvailable === false ? (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {t('appointments.visitPreparation.voiceUnavailable')}
        </Text>
      ) : null}
      {renderField('observations', 'includeObservations')}
      {renderField('questions', 'includeQuestions')}
      <View style={styles.actions}>
        {voiceAvailable ? (
          <LiquidGlassButton
            title={t(
              isReading
                ? 'appointments.visitPreparation.stopReadBack'
                : 'appointments.visitPreparation.readBack',
            )}
            onPress={() => {
              toggleReadBack();
            }}
            disabled={!message}
            tintColor={theme.colors.secondary}
            borderRadius={theme.borderRadius.button}
            accessibilityLabel={t(
              isReading
                ? 'appointments.visitPreparation.stopReadBack'
                : 'appointments.visitPreparation.readBack',
            )}
          />
        ) : null}
        <LiquidGlassButton
          title={t('appointments.visitPreparation.reviewInChat')}
          onPress={() => onReviewInChat(message)}
          disabled={!message}
          tintColor={theme.colors.cta}
          borderRadius={theme.borderRadius.button}
          shadowIntensity="medium"
        />
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {gap: theme.spacing['2.5']},
    title: {...theme.typography.subtitleBold14, color: theme.colors.ink},
    description: {...theme.typography.body12, color: theme.colors.inkMuted},
    status: {...theme.typography.body12, color: theme.colors.inkMuted},
    fieldGroup: {gap: theme.spacing['2']},
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldLabel: {...theme.typography.body14, color: theme.colors.inkBody},
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.colors.controlBorder,
      borderRadius: theme.borderRadius.field,
      backgroundColor: theme.colors.fieldBg,
      color: theme.colors.inkBody,
      padding: theme.spacing['3'],
      ...theme.typography.body14,
    },
    actions: {gap: theme.spacing['2.5']},
  });
