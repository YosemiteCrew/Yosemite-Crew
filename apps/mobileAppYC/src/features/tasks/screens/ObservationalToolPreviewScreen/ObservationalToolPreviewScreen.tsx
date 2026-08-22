import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View, Platform} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import type {TaskStackParamList} from '@/navigation/types';
import {observationalToolDefinitions} from '@/features/observationalTools/data';
import {
  getCachedObservationTool,
  observationToolApi,
  type ObservationToolDefinitionRemote,
  type ObservationToolSubmission,
} from '@/features/observationalTools/services/observationToolService';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {describeRequestError} from '../../../../shared/utils/safeErrorLog';

type Navigation = NativeStackNavigationProp<
  TaskStackParamList,
  'ObservationalToolPreview'
>;
type Route = RouteProp<TaskStackParamList, 'ObservationalToolPreview'>;

const normalizeToken = (value?: string | null) =>
  (value ?? '').toLowerCase().replaceAll(/[^a-z0-9]/g, '');

export const ObservationalToolPreviewScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {taskId, toolId} = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] =
    useState<ObservationToolSubmission | null>(null);
  const [definition, setDefinition] =
    useState<ObservationToolDefinitionRemote | null>(null);

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
        console.warn(
          '[OT Preview] Failed to fetch tool definition',
          describeRequestError(defError),
        );
      }
    };

    const load = async () => {
      try {
        setLoading(true);
        // The task preview resolves the latest submission for this task, which is
        // the same row the task's otSubmissionId points at.
        const preview = await observationToolApi.previewTaskSubmission(taskId);

        if (!isMounted) return;

        setSubmission(preview);
        const toolKey = preview.toolId || toolId;
        if (toolKey) {
          await loadDefinition(toolKey);
        }
      } catch (err) {
        // Never the raw error: it carries the request config, including the
        // Authorization header.
        console.warn(
          '[OT Preview] Failed to load submission',
          describeRequestError(err),
        );
        if (isMounted) {
          setError('Unable to load submission. Please try again.');
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
  }, [taskId, toolId]);

  const staticDefinition = useMemo(() => {
    const lookupId = submission?.toolId ?? toolId ?? '';
    if (
      lookupId &&
      (observationalToolDefinitions as Record<string, any>)[lookupId]
    ) {
      return (observationalToolDefinitions as Record<string, any>)[lookupId];
    }
    const normalizedName = normalizeToken(
      submission?.toolName ?? definition?.name ?? '',
    );
    if (!normalizedName) return null;
    return Object.values(observationalToolDefinitions).find(
      def =>
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
    resolveObservationalToolLabel(
      toolId ?? submission?.toolId ?? 'Observational tool',
    );
  const overviewTitle = staticDefinition?.overviewTitle ?? toolLabel;
  const overviewParagraph = staticDefinition?.overviewParagraphs?.[0];
  // toolLabel (the hero title) already names the specific tool, so the
  // subtitle should not restate a category — there's no per-tool category
  // data, and hardcoding "Pain assessment" mislabels non-pain tools.
  const heroSubtitle = submissionDateLabel
    ? `Submitted on ${submissionDateLabel}`
    : 'Assessment record';
  const instructionText = staticDefinition?.steps?.[0]?.subtitle;
  const attribution = staticDefinition?.steps?.[0]?.footerNote;

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Observational tool"
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['4']}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          {loading && (
            <Text style={styles.statusText}>Loading submission...</Text>
          )}
          {!loading && error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && submission && (
            <>
              <View style={styles.hero}>
                <View style={styles.heroTile}>
                  <Ionicons
                    name="pulse-outline"
                    size={24}
                    color={theme.colors.avatarVioletInk}
                  />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>{toolLabel}</Text>
                  <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
                </View>
              </View>

              {submission.summary ? (
                <Text style={styles.summary}>{submission.summary}</Text>
              ) : null}

              {overviewParagraph ? (
                <LiquidGlassCard
                  glassEffect="clear"
                  padding="4"
                  shadow="sm"
                  style={styles.explainerCard}
                  fallbackStyle={styles.glassFallback}>
                  <Text style={styles.explainerHeading}>{overviewTitle}</Text>
                  <Text style={styles.overviewText}>{overviewParagraph}</Text>
                </LiquidGlassCard>
              ) : null}

              {instructionText ? (
                <View style={styles.callout}>
                  <Ionicons
                    name="eye-outline"
                    size={17}
                    color={theme.colors.navActive}
                    style={styles.calloutIcon}
                  />
                  <Text style={styles.calloutText}>{instructionText}</Text>
                </View>
              ) : null}

              <LiquidGlassCard
                glassEffect="clear"
                padding="4"
                shadow="sm"
                style={styles.responsesCard}
                fallbackStyle={styles.glassFallback}>
                <Text style={styles.sectionTitle}>Responses</Text>
                {answerItems.length ? (
                  answerItems.map((item, index) => (
                    <View key={item.key} style={styles.answerRow}>
                      <View style={styles.answerNumber}>
                        <Text style={styles.answerNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.answerBody}>
                        <Text style={styles.answerLabel}>{item.label}</Text>
                        <Text style={styles.answerValue}>{item.value}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.statusText}>No responses available.</Text>
                )}
              </LiquidGlassCard>

              {attribution ? (
                <Text style={styles.footer}>{attribution}</Text>
              ) : null}
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
      paddingHorizontal: theme.spacing['5'],
      gap: theme.spacing['3.5'],
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3.5'],
    },
    heroTile: {
      width: 54,
      height: 54,
      borderRadius: theme.borderRadius.cardSmall,
      backgroundColor: theme.colors.avatarVioletBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroText: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    heroTitle: {
      ...theme.typography.serifTitleSmall,
      color: theme.colors.ink,
    },
    heroSubtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkFaint,
    },
    summary: {
      ...theme.typography.body14,
      color: theme.colors.inkBody,
    },
    explainerCard: {
      gap: theme.spacing['2'],
      backgroundColor: theme.colors.screen,
    },
    explainerHeading: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
    },
    overviewText: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
    },
    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2.5'],
      backgroundColor: theme.colors.blueSoft,
      borderRadius: theme.borderRadius.field,
      paddingVertical: theme.spacing['3.5'],
      paddingHorizontal: theme.spacing['3.5'],
    },
    calloutIcon: {
      marginTop: 1,
    },
    calloutText: {
      ...theme.typography.body13,
      color: theme.colors.navActive,
      flex: 1,
    },
    responsesCard: {
      gap: theme.spacing['2.5'],
      backgroundColor: theme.colors.screen,
    },
    sectionTitle: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
    },
    answerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.field,
      paddingVertical: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['3.5'],
    },
    answerNumber: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    answerNumberText: {
      ...theme.typography.subtitleBold12,
      color: theme.colors.navActive,
    },
    answerBody: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    answerLabel: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.inkBody,
      textTransform: 'capitalize',
    },
    answerValue: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
    },
    footer: {
      ...theme.typography.caption,
      color: theme.colors.inkFaint2,
      textAlign: 'center',
      paddingTop: theme.spacing['1'],
      paddingBottom: theme.spacing['5'],
    },
    statusText: {
      ...theme.typography.body14,
      color: theme.colors.inkMuted,
    },
    errorText: {
      ...theme.typography.body14,
      color: theme.colors.error,
    },
    glassFallback: {
      backgroundColor: theme.colors.screen,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.hairline,
      boxShadow: `0px 1px 6px ${theme.colors.neutralShadow}`,
    },
  });

export default ObservationalToolPreviewScreen;
