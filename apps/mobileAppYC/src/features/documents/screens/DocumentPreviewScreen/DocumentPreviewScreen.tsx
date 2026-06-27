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
import {createAllCommonStyles} from '@/shared/utils/screenStyles';
import DocumentAttachmentViewer from '@/features/documents/components/DocumentAttachmentViewer';
import {fetchDocumentView} from '@/features/documents/documentSlice';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {DOCUMENT_CATEGORIES, VISIT_TYPES} from '@/features/documents/constants';

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

const resolveVisitTypeLabel = (visitTypeId?: string | null): string =>
  VISIT_TYPES.find(v => v.id === visitTypeId)?.label ?? visitTypeId ?? '';
import {
  DetailsCard,
  type DetailItem,
  type DetailBadge,
} from '@/shared/components/common/DetailsCard';
import {parseISODate} from '@/shared/utils/dateHelpers';

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

  // Sharing is handled inside AttachmentPreview for individual files
  const handleEdit = () => {
    navigation.navigate('EditDocument', {documentId});
  };

  // Only allow edit/delete for documents added by user from app, not from PMS
  const canEdit = document.isUserAdded && !document.uploadedByPmsUserId;

  const detailItems: DetailItem[] = [
    {label: 'Title', value: document.title},
    {label: 'Companion', value: companion?.name || 'Unknown'},
    {label: 'Business', value: document.businessName || '—'},
    {label: 'Category', value: resolveCategoryLabel(document.category)},
    {
      label: 'Sub category',
      value: resolveSubcategoryLabel(document.category, document.subcategory),
      hidden: !document.subcategory || document.subcategory === 'none',
    },
    {
      label: 'Visit type',
      value: resolveVisitTypeLabel(document.visitType),
      hidden: !document.visitType || document.visitType === 'other',
    },
    {label: 'Issue Date', value: formattedIssueDate},
    {
      label: 'Appointment ID',
      value: document.appointmentId || '',
      hidden: !document.appointmentId,
    },
    {label: 'Files', value: document.files?.length || 0},
    {
      label: 'Created',
      value: new Date(document.createdAt).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    },
  ];

  const badges: DetailBadge[] = [];
  if (document.uploadedByPmsUserId) {
    badges.push({
      text: 'Synced from PMS',
      backgroundColor: theme.colors.infoSurface,
      textColor: theme.colors.primary,
    });
  } else if (document.isUserAdded) {
    badges.push({
      text: 'User Added',
      backgroundColor: theme.colors.successSurface,
      textColor: theme.colors.success,
    });
  }

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={document.title}
          showBackButton={true}
          onBack={() => navigation.goBack()}
          onRightPress={canEdit ? handleEdit : undefined}
          rightIcon={canEdit ? Images.blackEdit : undefined}
          glass={false}
        />
      }
      contentPadding={theme.spacing['4']}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            contentPaddingStyle,
          ]}>
          <DetailsCard
            title="Document Details"
            items={detailItems}
            badges={badges}
          />

          <View style={styles.documentPreview}>
            <DocumentAttachmentViewer
              attachments={document.files}
              documentTitle={document.title}
              companionName={companion?.name}
            />
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) => {
  const commonStyles = createAllCommonStyles(theme);
  return StyleSheet.create({
    ...commonStyles,
    contentContainer: {
      ...commonStyles.contentContainer,
      paddingHorizontal: theme.spacing['6'],
      gap: theme.spacing['4'],
    },
    documentPreview: {
      gap: theme.spacing['4'],
    },
  });
};
