import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Header} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from '../components/LegalContentRenderer';
import {exportLegalDocument} from '../services/legalExportService';
import type {LegalSection, LegalContentBlock} from '../data/legalContentTypes';
import {
  organisationDocumentService,
  type OrganisationDocumentCategory,
  type OrganisationDocument,
} from '../services/organisationDocumentService';
import type {AppointmentStackParamList} from '@/navigation/types';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Props = NativeStackScreenProps<
  AppointmentStackParamList,
  'OrganisationDocument'
>;

const CATEGORY_TITLES: Record<OrganisationDocumentCategory, string> = {
  TERMS_AND_CONDITIONS: 'Terms & Conditions',
  PRIVACY_POLICY: 'Privacy Policy',
  CANCELLATION_POLICY: 'Cancellation Policy',
};

const toParagraphBlocks = (
  description?: string | null,
): LegalContentBlock[] => {
  if (!description) {
    return [];
  }

  const paragraphs = description.split(/\n+/).flatMap(part => {
    const t = part.trim();
    return t ? [t] : [];
  });

  if (paragraphs.length === 0) {
    return [];
  }

  return paragraphs.map(text => ({
    type: 'paragraph',
    segments: [{text}],
  }));
};

const mapDocumentsToSections = (
  docs: OrganisationDocument[],
  fallbackTitle: string,
): LegalSection[] => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return [];
  }

  return docs.map((doc, index) => {
    const blocks = toParagraphBlocks(doc.description);
    const hasBlocks = blocks.length > 0;
    return {
      id: doc.id || `${doc.category}-${doc.organisationId}-${index}`,
      title: doc.title || fallbackTitle,
      blocks: hasBlocks
        ? blocks
        : [
            {
              type: 'paragraph',
              segments: [
                {
                  text: 'No additional details were provided for this document.',
                },
              ],
            },
          ],
    };
  });
};

export const OrganisationDocumentScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const {organisationId, organisationName, category} = route.params;
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [error, setError] = React.useState<string | null>(null);
  const [sections, setSections] = React.useState<LegalSection[] | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const loading = sections === null && error === null;

  const baseTitle = CATEGORY_TITLES[category] ?? 'Document';
  const screenTitle = organisationName
    ? `${organisationName} ${baseTitle}`
    : baseTitle;

  const orgLabel = organisationName?.trim() || baseTitle;
  const badgeLetter = orgLabel.charAt(0).toUpperCase();

  const handleRetry = React.useCallback(() => {
    setSections(null);
    setError(null);
    setRetryCount(n => n + 1);
  }, []);

  const handleDownload = React.useCallback(() => {
    exportLegalDocument(screenTitle, sections ?? []);
  }, [screenTitle, sections]);

  const handleAcknowledge = React.useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docs = await organisationDocumentService.fetchDocuments({
          organisationId,
          category,
        });
        if (!cancelled) {
          setSections(mapDocumentsToSections(docs, baseTitle));
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            (err as any)?.message ??
            'Unable to load this document right now. Please try again.';
          setError(message);
          setSections([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseTitle, category, organisationId, retryCount]);

  const hasContent = sections !== null && sections.length > 0;

  let stateContent: React.ReactNode;

  if (loading) {
    stateContent = (
      <View style={[styles.statusCard, styles.centerContent]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.statusTitle}>
          Loading {baseTitle.toLowerCase()}…
        </Text>
        <Text style={styles.statusText}>
          Fetching the latest {baseTitle.toLowerCase()} from the clinic.
        </Text>
      </View>
    );
  } else if (error) {
    stateContent = (
      <LiquidGlassCard
        glassEffect="clear"
        padding="4"
        shadow="sm"
        style={styles.statusCard}
        fallbackStyle={styles.cardFallback}>
        <Text style={styles.statusTitle}>Unable to load</Text>
        <Text style={styles.statusText}>{error}</Text>
        <LiquidGlassButton
          title="Retry"
          onPress={handleRetry}
          height={48}
          borderRadius={16}
          shadowIntensity="medium"
        />
      </LiquidGlassCard>
    );
  } else {
    stateContent = (
      <LiquidGlassCard
        glassEffect="clear"
        padding="4"
        shadow="sm"
        style={styles.statusCard}
        fallbackStyle={styles.cardFallback}>
        <Text style={styles.statusTitle}>No content available</Text>
        <Text style={styles.statusText}>
          {organisationName ?? 'This clinic'} has not shared a{' '}
          {baseTitle.toLowerCase()} yet.
        </Text>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={screenTitle}
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      cardGap={theme.spacing['3']}
      contentPadding={theme.spacing['1']}
      useSafeAreaView
      showBottomFade={false}>
      {contentPaddingStyle =>
        hasContent ? (
          <View style={[styles.contentRoot, contentPaddingStyle]}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetBrand}>
                  <View style={styles.sheetBadge}>
                    <Text style={styles.sheetBadgeText}>{badgeLetter}</Text>
                  </View>
                  <Text style={styles.sheetOrgName} numberOfLines={1}>
                    {orgLabel.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.sheetPageIndicator}>Page 1 / 1</Text>
              </View>

              <Text style={styles.sheetDocTitle}>{baseTitle}</Text>

              <View style={styles.sheetDivider} />

              <ScrollView
                style={styles.sheetBodyScroll}
                contentContainerStyle={styles.sheetBodyContent}
                showsVerticalScrollIndicator={false}>
                <LegalContentRenderer sections={sections} />
              </ScrollView>
            </View>

            <View style={styles.actionBar}>
              <PressableOpacity
                testID="organisation-document-download"
                accessibilityRole="button"
                accessibilityLabel="Download"
                onPress={handleDownload}
                style={styles.downloadAction}>
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={theme.colors.inkBody}
                />
                <Text style={styles.downloadActionText}>Download</Text>
              </PressableOpacity>

              <PressableOpacity
                testID="organisation-document-acknowledge"
                accessibilityRole="button"
                accessibilityLabel="Acknowledge"
                onPress={handleAcknowledge}
                style={styles.acknowledgeAction}>
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={theme.colors.ctaText}
                />
                <Text style={styles.acknowledgeActionText}>Acknowledge</Text>
              </PressableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.container}
            contentContainerStyle={[
              styles.stateContent,
              contentPaddingStyle,
              !error && !loading ? styles.centerContent : null,
            ]}
            showsVerticalScrollIndicator={false}>
            {stateContent}
          </ScrollView>
        )
      }
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    stateContent: {
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['4'],
    },
    centerContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    statusCard: {
      gap: theme.spacing['2'],
      padding: theme.spacing['5'],
      alignItems: 'center',
    },
    statusTitle: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    statusText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.inkMuted,
      textAlign: 'center',
    },
    cardFallback: {
      borderRadius: theme.borderRadius.card,
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      ...theme.shadows.card,
    },
    // --- Paper "sheet" document viewer ---
    contentRoot: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      minHeight: 0,
      marginTop: theme.spacing['4'],
      marginHorizontal: theme.spacing['5'],
      backgroundColor: theme.colors.fieldBg,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
      paddingHorizontal: 22,
      paddingVertical: theme.spacing['6'],
      overflow: 'hidden',
      boxShadow: `inset 0px 1px 4px ${theme.colors.neutralShadow}`,
    },
    sheetHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
    },
    sheetBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      flexShrink: 1,
    },
    sheetBadge: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetBadgeText: {
      fontFamily: theme.typography.SATOSHI_BOLD,
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.blueText,
    },
    sheetOrgName: {
      fontFamily: theme.typography.SATOSHI_BOLD,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.colors.inkBody,
      flexShrink: 1,
    },
    sheetPageIndicator: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 10.5,
      color: theme.colors.inkFaint2,
    },
    sheetDocTitle: {
      fontFamily: theme.typography.SATOSHI_BOLD,
      fontSize: 16.5,
      fontWeight: '700',
      letterSpacing: -0.2,
      color: theme.colors.ink,
      marginTop: theme.spacing['3.5'],
    },
    sheetDivider: {
      height: 1,
      backgroundColor: theme.colors.hairline,
      marginTop: theme.spacing['3'],
      marginBottom: theme.spacing['2'],
    },
    sheetBodyScroll: {
      flex: 1,
    },
    sheetBodyContent: {
      paddingTop: theme.spacing['1'],
      paddingBottom: theme.spacing['2'],
    },
    // --- Bottom action bar ---
    actionBar: {
      flexDirection: 'row',
      gap: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3.5'],
      paddingBottom: theme.spacing['6'],
    },
    downloadAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      backgroundColor: 'transparent',
    },
    downloadActionText: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 15.5,
      fontWeight: '500',
      color: theme.colors.inkBody,
    },
    acknowledgeAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.colors.cta,
      ...theme.shadows.cta,
    },
    acknowledgeActionText: {
      fontFamily: theme.typography.SATOSHI_MEDIUM,
      fontSize: 15.5,
      fontWeight: '500',
      color: theme.colors.ctaText,
    },
  });

export default OrganisationDocumentScreen;
