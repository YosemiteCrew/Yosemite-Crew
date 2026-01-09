import React from 'react';
import {ActivityIndicator, ScrollView, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Header} from '@/shared/components/common';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {LegalContentRenderer} from '../components/LegalContentRenderer';
import {createLegalStyles} from '../styles/legalStyles';
import type {LegalSection, LegalContentBlock} from '../data/legalContentTypes';
import {
  organisationDocumentService,
  type OrganisationDocumentCategory,
  type OrganisationDocument,
} from '../services/organisationDocumentService';
import type {AppointmentStackParamList} from '@/navigation/types';
import {useCommonScreenStyles} from '@/shared/utils/screenStyles';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Props = NativeStackScreenProps<AppointmentStackParamList, 'OrganisationDocument'>;

const CATEGORY_TITLES: Record<OrganisationDocumentCategory, string> = {
  TERMS_AND_CONDITIONS: 'Terms & Conditions',
  PRIVACY_POLICY: 'Privacy Policy',
  CANCELLATION_POLICY: 'Cancellation Policy',
};

const toParagraphBlocks = (description?: string | null): LegalContentBlock[] => {
  if (!description) {
    return [];
  }

  const paragraphs = description
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean);

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
              segments: [{text: 'No additional details were provided for this document.'}],
            },
          ],
    };
  });
};

export const OrganisationDocumentScreen: React.FC<Props> = ({navigation, route}) => {
  const {organisationId, organisationName, category} = route.params;
  const {theme} = useTheme();
  const baseStyles = React.useMemo(() => createLegalStyles(theme), [theme]);
  const styles = useCommonScreenStyles(theme);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sections, setSections] = React.useState<LegalSection[]>([]);

  const baseTitle = CATEGORY_TITLES[category] ?? 'Document';
  const screenTitle = organisationName
    ? `${organisationName} ${baseTitle}`
    : baseTitle;

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await organisationDocumentService.fetchDocuments({
        organisationId,
        category,
      });
      setSections(mapDocumentsToSections(docs, baseTitle));
    } catch (err) {
      const message =
        (err as any)?.message ??
        'Unable to load this document right now. Please try again.';
      setError(message);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [baseTitle, category, organisationId]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const hasContent = sections.length > 0;

  let content: React.ReactNode;

  if (loading) {
    content = (
      <View style={[styles.statusCard, styles.centerContent]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.statusTitle}>Loading {baseTitle.toLowerCase()}…</Text>
        <Text style={styles.statusText}>
          Fetching the latest {baseTitle.toLowerCase()} from the clinic.
        </Text>
      </View>
    );
  } else if (error) {
    content = (
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
          onPress={loadDocuments}
          height={48}
          borderRadius={16}
          shadowIntensity="medium"
        />
      </LiquidGlassCard>
    );
  } else if (hasContent) {
    content = <LegalContentRenderer sections={sections} />;
  } else {
    content = (
      <LiquidGlassCard
        glassEffect="clear"
        padding="4"
        shadow="sm"
        style={styles.statusCard}
        fallbackStyle={styles.cardFallback}>
        <Text style={styles.statusTitle}>No content available</Text>
        <Text style={styles.statusText}>
          {organisationName ?? 'This clinic'} has not shared a {baseTitle.toLowerCase()} yet.
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
      {contentPaddingStyle => (
        <ScrollView
          style={baseStyles.container}
          contentContainerStyle={[
            baseStyles.contentContainer,
            contentPaddingStyle,
            !hasContent && !error && !loading ? styles.centerContent : null,
          ]}
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

export default OrganisationDocumentScreen;
