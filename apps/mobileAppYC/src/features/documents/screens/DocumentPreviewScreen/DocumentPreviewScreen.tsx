import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet, Alert, Share} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {downloadDocumentToAppStorage} from '@/shared/utils/documentDownload';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import type {Theme} from '@/theme';
import {createAllCommonStyles} from '@/shared/utils/screenStyles';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {fetchDocumentView} from '@/features/documents/documentSlice';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {DOCUMENT_CATEGORIES} from '@/features/documents/constants';
import {parseISODate} from '@/shared/utils/dateHelpers';

const resolveCategoryLabel = (categoryId?: string | null): string =>
  DOCUMENT_CATEGORIES.find(c => c.id === categoryId)?.label ?? categoryId ?? '';

const resolveSubcategoryLabel = (
  categoryId?: string | null,
  subcategoryId?: string | null,
): string => {
  const cat = DOCUMENT_CATEGORIES.find(c => c.id === categoryId);
  return (
    cat?.subcategories.find(s => s.id === subcategoryId)?.label ??
    subcategoryId ??
    ''
  );
};

const resolveFileUri = (file?: DocumentFile): string | null =>
  file
    ? (file.viewUrl ?? file.downloadUrl ?? file.s3Url ?? file.uri ?? null)
    : null;

const resolveFileTypeLabel = (file?: DocumentFile): string => {
  if (!file) {
    return '';
  }
  const fromName = file.name?.includes('.') ? file.name.split('.').pop() : '';
  const fromMime = file.type?.includes('/')
    ? file.type.split('/').pop()
    : file.type;
  return (fromName || fromMime || '').toUpperCase();
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

type DocumentPreviewNavigationProp =
  NativeStackNavigationProp<DocumentStackParamList>;
type DocumentPreviewRouteProp = RouteProp<
  DocumentStackParamList,
  'DocumentPreview'
>;

export const DocumentPreviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentPreviewNavigationProp>();
  const route = useRoute<DocumentPreviewRouteProp>();
  const dispatch = useDispatch<AppDispatch>();

  const {documentId, initialDocument} = route.params;
  const [isPdfInteracting, setIsPdfInteracting] = React.useState(false);

  const storedDocument = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );
  const document = storedDocument ?? initialDocument;
  const viewLoading = useSelector(
    (state: RootState) => !!state.documents.viewLoading[documentId],
  );

  const companion = useSelector((state: RootState) =>
    document
      ? state.companion.companions.find(c => c.id === document.companionId)
      : null,
  );

  const isViewableUri = React.useCallback(
    (uri?: string | null) =>
      typeof uri === 'string' &&
      /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(uri),
    [],
  );

  const hasViewableAttachments = React.useMemo(() => {
    if (!document?.files?.length) {
      return false;
    }
    return document.files.some(file => {
      const candidates = [file.viewUrl, file.downloadUrl, file.s3Url, file.uri];
      return candidates.some(uri => isViewableUri(uri));
    });
  }, [document?.files, isViewableUri]);

  React.useEffect(() => {
    if (!document) {
      return;
    }
    const needsFreshUrls = document.files?.some(file => {
      const hasView = isViewableUri(file.viewUrl);
      const hasDownload = isViewableUri(file.downloadUrl);
      return !(hasView && hasDownload);
    });

    if (viewLoading) {
      return;
    }

    if (!hasViewableAttachments || needsFreshUrls) {
      dispatch(fetchDocumentView({documentId}));
    }
  }, [
    dispatch,
    document,
    documentId,
    hasViewableAttachments,
    isViewableUri,
    viewLoading,
  ]);

  const formattedIssueDate = React.useMemo(() => {
    if (!document?.issueDate) {
      return '—';
    }
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(document.issueDate)
      ? parseISODate(document.issueDate)
      : new Date(document.issueDate);
    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }
    return parsed.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [document?.issueDate]);

  if (!document) {
    return (
      <SafeArea>
        <Header
          title="Document"
          showBackButton={true}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Document not found</Text>
        </View>
      </SafeArea>
    );
  }

  const handleEdit = () => {
    navigation.navigate('EditDocument', {documentId});
  };

  // Only allow edit/delete for documents added by user from app, not from PMS
  const canEdit = document.isUserAdded && !document.uploadedByPmsUserId;
  const isSynced = !!document.uploadedByPmsUserId;

  const primaryFile = document.files?.[0];
  const primaryUri = resolveFileUri(primaryFile);
  const fileMeta = [
    resolveFileTypeLabel(primaryFile),
    formatFileSize(primaryFile?.size),
  ]
    .filter(Boolean)
    .join(' · ');

  const subtitleType =
    document.subcategory && document.subcategory !== 'none'
      ? resolveSubcategoryLabel(document.category, document.subcategory)
      : resolveCategoryLabel(document.category);
  const subtitle = [subtitleType, formattedIssueDate]
    .filter(Boolean)
    .join(' · ');

  const shareLabel = companion?.name
    ? `${document.title} for ${companion.name}`
    : document.title;

  const handleShare = async () => {
    try {
      await Share.share({
        title: shareLabel,
        message: primaryUri ? `${shareLabel}\n\n${primaryUri}` : shareLabel,
        url: primaryUri ?? '',
      });
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to share',
      );
    }
  };

  const handleDownload = async () => {
    if (!primaryUri) {
      Alert.alert(
        'Unavailable',
        'We could not find a download link for this file. Please try again later.',
      );
      return;
    }
    try {
      const safeName = (primaryFile?.name || 'document').replace(
        /[\\/:]/g,
        '_',
      );
      const target = await downloadDocumentToAppStorage(primaryUri, safeName);
      Alert.alert('Download complete', `Saved to:\n${target}`);
    } catch {
      Alert.alert(
        'Download failed',
        'Unable to download the file. Please check your connection and try again.',
      );
    }
  };

  const headerNode = (
    <DocumentPreviewHeader
      styles={styles}
      theme={theme}
      title={document.title}
      subtitle={subtitle}
      canEdit={canEdit}
      onBack={() => navigation.goBack()}
      onEdit={handleEdit}
    />
  );

  return (
    <LiquidGlassHeaderScreen
      header={headerNode}
      contentPadding={theme.spacing['4']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <View style={styles.flex}>
          <ScrollView
            style={styles.container}
            nestedScrollEnabled
            scrollEnabled={!isPdfInteracting}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.contentContainer,
              contentPaddingStyle,
            ]}>
            <View style={styles.documentPage}>
              <DocumentAttachmentViewer
                attachments={document.files}
                documentTitle={document.title}
                companionName={companion?.name}
                onPdfTouchStart={() => setIsPdfInteracting(true)}
                onPdfTouchEnd={() => setIsPdfInteracting(false)}
              />
            </View>
          </ScrollView>

          <DocumentPreviewFooter
            styles={styles}
            theme={theme}
            businessName={document.businessName}
            companionName={companion?.name}
            fileMeta={fileMeta}
            isSynced={isSynced}
            onShare={handleShare}
            onDownload={handleDownload}
          />
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

type DocumentPreviewHeaderProps = {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  title: string;
  subtitle: string;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
};

const DocumentPreviewHeader: React.FC<DocumentPreviewHeaderProps> = ({
  styles,
  theme,
  title,
  subtitle,
  canEdit,
  onBack,
  onEdit,
}) => (
  <View style={styles.header} testID="document-preview-header">
    <PressableOpacity
      testID="header-back-btn"
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.circleButton}
      onPress={onBack}>
      <Ionicons name="chevron-back" size={18} color={theme.colors.inkBody} />
    </PressableOpacity>

    <View style={styles.headerTitleBlock}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>

    {canEdit ? (
      <PressableOpacity
        testID="header-right-btn"
        accessibilityRole="button"
        accessibilityLabel="Document options"
        style={styles.circleButton}
        onPress={onEdit}>
        <Ionicons
          name="ellipsis-horizontal"
          size={17}
          color={theme.colors.inkBody}
        />
      </PressableOpacity>
    ) : (
      <View style={styles.circleButton} />
    )}
  </View>
);

type DocumentPreviewFooterProps = {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  businessName?: string | null;
  companionName?: string | null;
  fileMeta: string;
  isSynced: boolean;
  onShare: () => void;
  onDownload: () => void;
};

const DocumentPreviewFooter: React.FC<DocumentPreviewFooterProps> = ({
  styles,
  theme,
  businessName,
  companionName,
  fileMeta,
  isSynced,
  onShare,
  onDownload,
}) => (
  <View style={styles.footer}>
    <View style={styles.metaRow}>
      <View style={styles.metaItem}>
        <Ionicons
          name="business-outline"
          size={14}
          color={theme.colors.inkFaint}
        />
        <Text style={styles.metaText} numberOfLines={1}>
          {businessName || '—'}
        </Text>
      </View>
      <View style={styles.metaItem}>
        <Ionicons name="paw-outline" size={14} color={theme.colors.inkFaint} />
        <Text style={styles.metaText} numberOfLines={1}>
          {companionName || 'Unknown'}
        </Text>
      </View>
      {!!fileMeta && (
        <View style={styles.metaItem}>
          <Ionicons
            name="document-outline"
            size={14}
            color={theme.colors.inkFaint}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {fileMeta}
          </Text>
        </View>
      )}
      {isSynced && (
        <View style={styles.syncedPill}>
          <View style={styles.syncedDot} />
          <Text style={styles.syncedText}>SYNCED</Text>
        </View>
      )}
    </View>

    <View style={styles.actionRow}>
      <PressableOpacity
        style={[styles.actionButton, styles.actionPrimary]}
        accessibilityRole="button"
        accessibilityLabel="Share document"
        onPress={onShare}>
        <Ionicons name="share-outline" size={17} color={theme.colors.ctaText} />
        <Text style={styles.actionPrimaryText}>Share</Text>
      </PressableOpacity>
      <PressableOpacity
        style={[styles.actionButton, styles.actionSecondary]}
        accessibilityRole="button"
        accessibilityLabel="Download document"
        onPress={onDownload}>
        <Ionicons
          name="download-outline"
          size={17}
          color={theme.colors.inkBody}
        />
        <Text style={styles.actionSecondaryText}>Download</Text>
      </PressableOpacity>
    </View>
  </View>
);

const createStyles = (theme: any) => {
  const commonStyles = createAllCommonStyles(theme);
  return StyleSheet.create({
    ...commonStyles,
    flex: {
      flex: 1,
    },
    contentContainer: {
      ...commonStyles.contentContainer,
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['4'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['5'],
      paddingVertical: theme.spacing['2'],
    },
    circleButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleBlock: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...theme.typography.labelSmall,
      fontSize: 15.5,
      letterSpacing: -0.2,
      color: theme.colors.ink,
      textAlign: 'center',
    },
    headerSubtitle: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
      textAlign: 'center',
      marginTop: 1,
    },
    documentPage: {
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
      padding: theme.spacing['4'],
      boxShadow: `inset 0px 1px 4px ${theme.colors.neutralShadow}`,
    },
    footer: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['3.5'],
      paddingBottom: theme.spacing['6'],
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.background,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing['2.5'],
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
    },
    metaText: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
    },
    syncedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: 3,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    syncedDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.success,
    },
    syncedText: {
      ...theme.typography.labelXxsBold,
      fontSize: 10.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: theme.colors.inkMuted,
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing['2.5'],
    },
    actionButton: {
      flex: 1,
      height: 50,
      borderRadius: theme.borderRadius.field,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
    },
    actionPrimary: {
      backgroundColor: theme.colors.cta,
      boxShadow: theme.shadows.cta.boxShadow,
    },
    actionPrimaryText: {
      ...theme.typography.buttonSmall,
      fontSize: 14.5,
      color: theme.colors.ctaText,
    },
    actionSecondary: {
      borderWidth: 1,
      borderColor: theme.colors.divider,
      backgroundColor: theme.colors.transparent,
    },
    actionSecondaryText: {
      ...theme.typography.buttonSmall,
      fontSize: 14.5,
      color: theme.colors.inkBody,
    },
  });
};
