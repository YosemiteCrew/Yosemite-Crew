import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {downloadDocumentToAppStorage} from '@/shared/utils/documentDownload';
import {buildLegalFileName} from '../utils/legalFileName';
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
  const documentsRef = React.useRef<OrganisationDocument[]>([]);
  const [retryCount, setRetryCount] = React.useState(0);
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [acknowledging, setAcknowledging] = React.useState(false);
  const [acknowledgeError, setAcknowledgeError] = React.useState<string | null>(
    null,
  );
  const [downloading, setDownloading] = React.useState(false);
  const loading = sections === null && error === null;
  const primaryDocument = documentsRef.current[0] ?? null;

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

  const handleDownload = React.useCallback(async () => {
    if (!primaryDocument?.pdfUrl || downloading) {
      Alert.alert(
        'Unavailable',
        'We could not find a download link for this document. Please try again later.',
      );
      return;
    }
    setDownloading(true);
    try {
      const fileName = buildLegalFileName([
        orgLabel,
        baseTitle,
        primaryDocument.version ? `v${primaryDocument.version}` : null,
      ]);
      const downloadPath = await downloadDocumentToAppStorage(
        primaryDocument.pdfUrl,
        fileName,
      );
      Alert.alert('Download complete', `Saved to:\n${downloadPath}`);
    } catch (err) {
      const message =
        (err as any)?.message ??
        'Unable to download the file. Please check your connection and try again.';
      Alert.alert('Download failed', message);
    } finally {
      setDownloading(false);
    }
  }, [baseTitle, downloading, orgLabel, primaryDocument]);

  const handleAcknowledge = React.useCallback(async () => {
    if (!primaryDocument || acknowledging) {
      return;
    }
    setAcknowledging(true);
    setAcknowledgeError(null);
    try {
      await organisationDocumentService.acknowledgeDocument({
        organisationId,
        documentId: primaryDocument.id,
        category,
        version: primaryDocument.version ?? 1,
      });
      setAcknowledged(true);
      navigation.goBack();
    } catch (err) {
      const message =
        (err as any)?.message ??
        'Unable to save your acknowledgment. Please try again.';
      setAcknowledgeError(message);
    } finally {
      setAcknowledging(false);
    }
  }, [acknowledging, category, navigation, organisationId, primaryDocument]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await organisationDocumentService.fetchDocuments({
          organisationId,
          category,
        });
        if (cancelled) {
          return;
        }
        const docs = Array.isArray(result) ? result : [];
        documentsRef.current = docs;
        setSections(mapDocumentsToSections(docs, baseTitle));

        const primary = docs[0];
        if (primary) {
          try {
            const status =
              await organisationDocumentService.getAcknowledgeStatus({
                organisationId,
                documentId: primary.id,
              });
            if (!cancelled) {
              setAcknowledged(
                status.acknowledged &&
                  status.version === (primary.version ?? 1),
              );
            }
          } catch {
            // Acknowledgment status is a nice-to-have for this render pass;
            // the user can still acknowledge even if the check fails.
          }
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
                accessibilityState={{disabled: downloading}}
                disabled={downloading}
                onPress={handleDownload}
                style={styles.downloadAction}>
                {downloading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.inkBody}
                  />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={theme.colors.inkBody}
                  />
                )}
                <Text style={styles.downloadActionText}>Download</Text>
              </PressableOpacity>

              <PressableOpacity
                testID="organisation-document-acknowledge"
                accessibilityRole="button"
                accessibilityLabel={
                  acknowledged ? 'Acknowledged' : 'Acknowledge'
                }
                accessibilityState={{
                  disabled: acknowledged || acknowledging,
                }}
                disabled={acknowledged || acknowledging}
                onPress={handleAcknowledge}
                style={[
                  styles.acknowledgeAction,
                  (acknowledged || acknowledging) &&
                    styles.acknowledgeActionDisabled,
                ]}>
                {acknowledging ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.ctaText}
                  />
                ) : (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={theme.colors.ctaText}
                  />
                )}
                <Text style={styles.acknowledgeActionText}>
                  {acknowledged ? 'Acknowledged' : 'Acknowledge'}
                </Text>
              </PressableOpacity>
            </View>
            {acknowledgeError ? (
              <Text style={styles.acknowledgeErrorText}>
                {acknowledgeError}
              </Text>
            ) : null}
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
    acknowledgeActionDisabled: {
      opacity: 0.6,
    },
    acknowledgeErrorText: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.danger,
      textAlign: 'center',
      paddingHorizontal: theme.spacing['5'],
      marginTop: -theme.spacing['3'],
      paddingBottom: theme.spacing['3'],
    },
  });

export default OrganisationDocumentScreen;
