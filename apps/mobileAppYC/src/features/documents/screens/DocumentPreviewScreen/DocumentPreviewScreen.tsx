import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {useSelector, useDispatch} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import type {DocumentStackParamList} from '@/navigation/types';
import {Images} from '@/assets/images';
import {createScreenContainerStyles, createErrorContainerStyles} from '@/shared/utils/screenStyles';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {fetchDocumentView} from '@/features/documents/documentSlice';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type DocumentPreviewNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type DocumentPreviewRouteProp = RouteProp<DocumentStackParamList, 'DocumentPreview'>;

export const DocumentPreviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentPreviewNavigationProp>();
  const route = useRoute<DocumentPreviewRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);

  const {documentId} = route.params;

  const document = useSelector((state: RootState) =>
    state.documents.documents.find(doc => doc.id === documentId),
  );
  const viewLoading = useSelector(
    (state: RootState) => !!state.documents.viewLoading[documentId],
  );

  const companion = useSelector((state: RootState) =>
    document ? state.companion.companions.find(c => c.id === document.companionId) : null,
  );

  const hasViewableAttachments = React.useMemo(() => {
    if (!document?.files?.length) {
      return false;
    }
    return document.files.some(file => {
      const candidates = [file.viewUrl, file.downloadUrl, file.s3Url, file.uri];
      return candidates.some(
        uri => typeof uri === 'string' && /^https?:\/\//i.test(uri),
      );
    });
  }, [document?.files]);

  React.useEffect(() => {
    if (!document) {
      return;
    }
    const needsFreshUrls = document.files?.some(file => {
      const hasView =
        typeof file.viewUrl === 'string' && /^https?:\/\//i.test(file.viewUrl);
      const hasDownload =
        typeof file.downloadUrl === 'string' && /^https?:\/\//i.test(file.downloadUrl);
      return !(hasView && hasDownload);
    });

    if (viewLoading) {
      return;
    }

    if (!hasViewableAttachments || needsFreshUrls) {
      dispatch(fetchDocumentView({documentId}));
    }
  }, [dispatch, document, documentId, hasViewableAttachments, viewLoading]);

  const formattedIssueDate = React.useMemo(() => {
    if (!document?.issueDate) {
      return '—';
    }
    const parsed = new Date(document.issueDate);
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
        <Header title="Document" showBackButton={true} onBack={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Document not found</Text>
        </View>
      </SafeArea>
    );
  }

  // Sharing is handled inside AttachmentPreview for individual files
  const handleEdit = () => {
    navigation.navigate('EditDocument', {documentId});
  };

  // Only allow edit/delete for documents added by user from app, not from PMS
  const canEdit = document.isUserAdded && !document.uploadedByPmsUserId;

  return (
    <SafeArea>
      <View
        style={[styles.topSection, {paddingTop: insets.top}]}
        onLayout={event => {
          const height = event.nativeEvent.layout.height;
          if (height !== topGlassHeight) {
            setTopGlassHeight(height);
          }
        }}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive={false}
          style={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header
            title={document.title}
            showBackButton={true}
            onBack={() => navigation.goBack()}
            onRightPress={canEdit ? handleEdit : undefined}
            rightIcon={canEdit ? Images.blackEdit : undefined}
            glass={false}
          />
        </LiquidGlassCard>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['1']}
            : null,
        ]}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{document.title} for {companion?.name || 'Unknown'}</Text>
          <Text style={styles.infoText}>{document.businessName || '—'}</Text>
          <Text style={styles.infoText}>{formattedIssueDate}</Text>
        </View>

        <View style={styles.documentPreview}>
          <DocumentAttachmentViewer
            attachments={document.files}
            documentTitle={document.title}
            companionName={companion?.name}
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createScreenContainerStyles(theme),
    ...createErrorContainerStyles(theme),
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['6'],
    },
    topSection: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2,
    },
    topGlassCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    topGlassFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
    infoCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    infoTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['2'],
    },
    infoText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['1'],
    },
    documentPreview: {
      gap: theme.spacing['4'],
    },
  });
