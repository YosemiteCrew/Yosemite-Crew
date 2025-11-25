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

type DocumentPreviewNavigationProp = NativeStackNavigationProp<DocumentStackParamList>;
type DocumentPreviewRouteProp = RouteProp<DocumentStackParamList, 'DocumentPreview'>;

export const DocumentPreviewScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<DocumentPreviewNavigationProp>();
  const route = useRoute<DocumentPreviewRouteProp>();
  const dispatch = useDispatch<AppDispatch>();

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
    return parsed.toLocaleDateString();
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
      <Header
        title={document.title}
        showBackButton={true}
        onBack={() => navigation.goBack()}
        onRightPress={canEdit ? handleEdit : undefined}
        rightIcon={canEdit ? Images.blackEdit : undefined}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
    infoCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[4],
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    infoTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
    },
    infoText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[1],
    },
    documentPreview: {
      gap: theme.spacing[4],
    },
  });
