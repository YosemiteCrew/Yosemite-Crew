import React, {useEffect, useMemo, useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import type {TaskStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {observationalToolDefinitions} from '@/features/observationalTools/data';
import {
  getCachedObservationTool,
  observationToolApi,
  type ObservationToolDefinitionRemote,
  type ObservationToolSubmission,
} from '@/features/observationalTools/services/observationToolService';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'ObservationalToolPreview'>;
type Route = RouteProp<TaskStackParamList, 'ObservationalToolPreview'>;

export const ObservationalToolPreviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {taskId, submissionId, toolId} = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ObservationToolSubmission | null>(null);
  const [definition, setDefinition] = useState<ObservationToolDefinitionRemote | null>(null);

  const normalizeToken = (value?: string | null) =>
    (value ?? '')
      .toLowerCase()
      .replaceAll(/[^a-z0-9]/g, '');

  useEffect(() => {
    let isMounted = true;

    const loadDefinition = async (toolKey: string) => {
      const cached = getCachedObservationTool(toolKey);
      if (cached) {
        setDefinition(cached);
        return;
      }
      try {
        const def = await observationToolApi.get(toolKey);
        if (isMounted) {
          setDefinition(def);
        }
      } catch (defError) {
        console.warn('[OT Preview] Failed to fetch tool definition', defError);
      }
    };

    const load = async () => {
      try {
        setLoading(true);
        const preview = submissionId
          ? await observationToolApi.getSubmission(submissionId)
          : await observationToolApi.previewTaskSubmission(taskId);

        if (!isMounted) return;

        setSubmission(preview);
        const toolKey = preview.toolId || toolId;
        if (toolKey) {
          await loadDefinition(toolKey);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load submission');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [submissionId, taskId, toolId]);

  const staticDefinition = useMemo(() => {
    const lookupId = submission?.toolId ?? toolId ?? '';
    if (lookupId && (observationalToolDefinitions as Record<string, any>)[lookupId]) {
      return (observationalToolDefinitions as Record<string, any>)[lookupId];
    }
    const normalizedName = normalizeToken(
      submission?.toolName ?? definition?.name ?? '',
    );
    if (!normalizedName) return null;
    return Object.values(observationalToolDefinitions).find(def =>
      normalizeToken(def.name) === normalizedName ||
      normalizeToken(def.shortName) === normalizedName,
    );
  }, [definition?.name, submission?.toolId, submission?.toolName, toolId]);

  const answerItems = useMemo(() => {
    if (!submission) return [];
    const fields = definition?.fields ?? [];
    const labelMap = fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.key] = field.label ?? field.key;
      return acc;
    }, {});

    return Object.entries(submission.answers ?? {}).map(([key, value]) => {
      let displayValue: string;
      if (value === null || value === undefined) {
        displayValue = '';
      } else if (Array.isArray(value)) {
        displayValue = value.join(', ');
      } else if (typeof value === 'string') {
        displayValue = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        displayValue = String(value);
      } else {
        // Handle objects
        displayValue = JSON.stringify(value);
      }
      return {
        key,
        label: labelMap[key] ?? key.replaceAll('_', ' '),
        value: displayValue,
      };
    });
  }, [definition?.fields, submission]);

  const submissionDateLabel = submission?.createdAt
    ? formatDateForDisplay(new Date(submission.createdAt))
    : null;
  const toolLabel =
    definition?.name ??
    submission?.toolName ??
    resolveObservationalToolLabel(toolId ?? submission?.toolId ?? 'Observational tool');
  const overviewTitle = staticDefinition?.overviewTitle ?? toolLabel;
  const overviewParagraph = staticDefinition?.overviewParagraphs?.[0];
  const heroImage = staticDefinition?.heroImage ?? Images.otNoProviders;

  return (
    <LiquidGlassHeaderScreen
      header={<Header title="OT Submission" showBackButton onBack={() => navigation.goBack()} glass={false} />}
      contentPadding={theme.spacing['4']}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          {loading && <Text style={styles.statusText}>Loading submission...</Text>}
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && submission && (
            <>
              <LiquidGlassCard
                glassEffect="regular"
                interactive
                style={styles.summaryCard}
                fallbackStyle={styles.glassFallback}>
                <Image source={heroImage} style={styles.heroImage} />
                <Text style={styles.title}>{overviewTitle}</Text>
                {overviewParagraph ? (
                  <Text style={styles.overviewText}>{overviewParagraph}</Text>
                ) : null}
                {submissionDateLabel ? (
                  <Text style={styles.subtitle}>Submitted on {submissionDateLabel}</Text>
                ) : null}
                {submission.summary ? (
                  <Text style={styles.summary}>{submission.summary}</Text>
                ) : null}
              </LiquidGlassCard>

              <LiquidGlassCard
                glassEffect="regular"
                interactive
                style={styles.answersCard}
                fallbackStyle={styles.glassFallback}>
                <Text style={styles.sectionTitle}>Responses</Text>
                {answerItems.length ? (
                  answerItems.map(item => (
                    <View key={item.key} style={styles.answerRow}>
                      <Text style={styles.answerLabel}>{item.label}</Text>
                      <Text style={styles.answerValue}>{item.value}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.statusText}>No responses available.</Text>
                )}
              </LiquidGlassCard>
            </>
          )}
          {!loading && !error && !submission && (
            <Text style={styles.statusText}>No submission found.</Text>
          )}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      paddingBottom: theme.spacing['24'],
      paddingHorizontal: theme.spacing['4'],
      gap: theme.spacing['3'],
    },
    summaryCard: {
      gap: theme.spacing['2'],
      alignItems: 'center',
      // Spacing handled by container gap
    },
    answersCard: {
      gap: theme.spacing['3'],
      // Spacing handled by container gap
    },
    glassFallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    heroImage: {
      width: theme.spacing['28'],
      height: theme.spacing['28'],
      resizeMode: 'contain',
    },
    title: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    summary: {
      ...theme.typography.body14,
      color: theme.colors.secondary,
    },
    overviewText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    sectionTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    answerRow: {
      gap: theme.spacing['1'],
    },
    answerLabel: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    answerValue: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
    statusText: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
    },
    errorText: {
      ...theme.typography.body14,
      color: theme.colors.error,
    },
  });

export default ObservationalToolPreviewScreen;
