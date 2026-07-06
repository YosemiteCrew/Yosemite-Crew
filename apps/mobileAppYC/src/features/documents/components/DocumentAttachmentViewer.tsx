import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Share,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Pdf from 'react-native-pdf';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import createAttachmentStyles from '@/shared/utils/attachmentStyles';
import type {DocumentFile} from '@/features/documents/types';
import {
  isDocViewerFile,
  isImageFile,
  isPdfFile,
  resolveSourceUri,
} from './documentAttachmentUtils';
import RNFS from 'react-native-fs';
import {normalizeMimeType} from '@/shared/utils/mime';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const buildShareLabel = (
  documentTitle?: string,
  companionName?: string | null,
  fileName?: string,
) => {
  const baseTitle = documentTitle || fileName || 'Document';
  return companionName ? `${baseTitle} for ${companionName}` : baseTitle;
};

const PdfViewer: React.FC<{
  uri: string;
  fallback: React.ReactNode;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
}> = ({uri, fallback, onTouchStart, onTouchEnd}) => {
  const {theme} = useTheme();
  const {height: windowHeight} = useWindowDimensions();
  const height = Math.max(windowHeight * 0.6, 400);
  const [shouldFallback, setShouldFallback] = React.useState(false);
  const [pageInfo, setPageInfo] = React.useState({page: 1, numberOfPages: 1});

  if (shouldFallback) {
    return <>{fallback}</>;
  }

  // android-pdf-viewer has no native scrollbar (unlike iOS's UIScrollView),
  // so render a lightweight thumb driven by the page-change callbacks.
  const trackHeight = height - 24;
  const thumbHeight = Math.max(trackHeight / pageInfo.numberOfPages, 28);
  const thumbTop =
    pageInfo.numberOfPages > 1
      ? ((pageInfo.page - 1) / (pageInfo.numberOfPages - 1)) *
        (trackHeight - thumbHeight)
      : 0;
  const showScrollIndicator =
    Platform.OS === 'android' && pageInfo.numberOfPages > 1;

  return (
    <View
      style={[viewerStyles.pdfContainer(theme.borderRadius.lg), {height}]}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}>
      <Pdf
        source={{uri, cache: true}}
        style={viewerStyles.pdf}
        trustAllCerts={false}
        enablePaging
        enableAntialiasing
        spacing={4}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator
        renderActivityIndicator={() => (
          <View style={viewerStyles.loader}>
            <ActivityIndicator />
          </View>
        )}
        onLoadComplete={numberOfPages =>
          setPageInfo(prev => ({...prev, numberOfPages}))
        }
        onPageChanged={(page, numberOfPages) =>
          setPageInfo({page, numberOfPages})
        }
        onError={error => {
          console.warn('[DocumentAttachmentViewer] PDF error', error);
          setShouldFallback(true);
        }}
      />
      {showScrollIndicator && (
        <View
          style={viewerStyles.scrollTrack(trackHeight)}
          pointerEvents="none">
          <View
            style={[
              viewerStyles.scrollThumb(theme.colors.primary),
              {height: thumbHeight, top: thumbTop},
            ]}
          />
        </View>
      )}
    </View>
  );
};

const DocViewer: React.FC<{fallback?: React.ReactNode; fileName?: string}> = ({
  fallback,
  fileName,
}) => {
  const {theme} = useTheme();
  const {height: windowHeight} = useWindowDimensions();
  const height = Math.max(windowHeight * 0.6, 400);

  return (
    <View style={[viewerStyles.docContainer(theme.borderRadius.lg), {height}]}>
      {fallback ?? (
        <View style={viewerStyles.loader}>
          <Text
            style={viewerStyles.unsupportedText(theme.colors.textSecondary)}>
            {fileName
              ? `${fileName} cannot be previewed in-app for security reasons. Download the file to view it.`
              : 'This file type cannot be previewed in-app for security reasons. Download the file to view it.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const ensureStoragePermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  // For API 33+, writing to Downloads does not require legacy storage permission.
  if (Platform.Version >= 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const handleDownload = async (file: DocumentFile) => {
  const sourceUri = resolveSourceUri(file);
  if (!sourceUri) {
    Alert.alert(
      'Unavailable',
      'We could not find a download link for this file. Please try again later.',
    );
    return;
  }

  try {
    const hasPermission = await ensureStoragePermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission needed',
        'Please grant storage permission to download files.',
      );
      return;
    }

    const normalizedType = normalizeMimeType(file.type);
    const extension =
      (normalizedType && MIME_EXTENSION_MAP[normalizedType]) ||
      (normalizedType ? normalizedType.split('/').pop() : undefined) ||
      'bin';
    const safeName = (file.name || 'document').replaceAll(/[\\/:]/g, '_');
    const fileName = safeName.toLowerCase().endsWith(`.${extension}`)
      ? safeName
      : `${safeName}.${extension}`;
    const downloadDir =
      RNFS.DownloadDirectoryPath ?? RNFS.DocumentDirectoryPath;
    const downloadPath = `${downloadDir}/${fileName}`;
    await RNFS.mkdir(downloadDir);
    await RNFS.downloadFile({
      fromUrl: sourceUri,
      toFile: downloadPath,
      discretionary: true,
    }).promise;
    Alert.alert('Download complete', `Saved to:\n${downloadPath}`);
  } catch (error) {
    console.warn('[DocumentAttachmentViewer] Download error', error);
    Alert.alert(
      'Download failed',
      'Unable to download the file. Please check your connection and try again.',
    );
  }
};

export interface DocumentAttachmentViewerProps {
  attachments: DocumentFile[];
  documentTitle?: string;
  companionName?: string | null;
  onPdfTouchStart?: () => void;
  onPdfTouchEnd?: () => void;
}

export const DocumentAttachmentViewer: React.FC<
  DocumentAttachmentViewerProps
> = ({
  attachments,
  documentTitle,
  companionName,
  onPdfTouchStart,
  onPdfTouchEnd,
}) => {
  const {theme} = useTheme();
  const styles = createAttachmentStyles(theme);

  if (!attachments?.length) {
    return (
      <View style={styles.emptyStateContainer}>
        <Image source={Images.documentIcon} style={styles.emptyStateIcon} />
        <Text style={styles.emptyStateTitle}>No attachments available</Text>
        <Text style={styles.emptyStateSubtitle}>
          Uploaded files will appear here
        </Text>
      </View>
    );
  }
  const renderPlaceholder = (message: string) => (
    <View style={styles.pdfPlaceholder}>
      <Image source={Images.documentIcon} style={styles.pdfIcon} />
      <Text style={styles.pdfLabel}>{message}</Text>
    </View>
  );

  const handleShare = async (file: DocumentFile) => {
    const fileUrl = resolveSourceUri(file);
    const shareLabel = buildShareLabel(documentTitle, companionName, file.name);
    const shareMessage = fileUrl ? `${shareLabel}\n\n${fileUrl}` : shareLabel;

    try {
      await Share.share({
        title: shareLabel,
        message: shareMessage,
        url: fileUrl ?? '',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to share';
      Alert.alert('Error', message);
    }
  };

  return (
    <View style={{gap: theme.spacing['6']}}>
      {attachments.map(file => {
        const sourceUri = resolveSourceUri(file);
        const canPreview = Boolean(sourceUri);
        const isPdf = isPdfFile(file.type);
        const isDoc = isDocViewerFile(file.type);
        const placeholder = renderPlaceholder(
          canPreview
            ? 'Preview unavailable right now. Try downloading or check back later.'
            : 'File is missing or the link is broken.',
        );

        return (
          <View key={file.id} style={styles.previewCard}>
            <LiquidGlassCard
              glassEffect="clear"
              padding="4"
              shadow="sm"
              style={styles.previewContentCard}>
              <View style={styles.previewCardHeader}>
                <Text style={styles.pdfLabel}>{file.name}</Text>
              </View>

              {(() => {
                if (isImageFile(file.type) && sourceUri) {
                  return (
                    <Image
                      source={{uri: sourceUri}}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  );
                }
                if (isPdf && sourceUri) {
                  return (
                    <PdfViewer
                      uri={sourceUri}
                      fallback={placeholder}
                      onTouchStart={onPdfTouchStart}
                      onTouchEnd={onPdfTouchEnd}
                    />
                  );
                }
                if (isDoc && sourceUri) {
                  return (
                    <DocViewer
                      fileName={file.name}
                      fallback={renderPlaceholder(
                        'Preview disabled for this file type. Download the file to view it securely.',
                      )}
                    />
                  );
                }
                console.log('[DocumentAttachmentViewer] File not previewable', {
                  fileName: file.name,
                  fileType: file.type,
                  hasSourceUri: Boolean(sourceUri),
                  isImage: isImageFile(file.type),
                  isPdf,
                  isDoc,
                });
                return placeholder;
              })()}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShare(file)}
                  accessibilityRole="button"
                  accessibilityLabel="Share attachment">
                  <Image source={Images.shareIcon} style={styles.shareIcon} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => handleDownload(file)}
                  accessibilityRole="button"
                  accessibilityLabel="Download attachment">
                  <Image
                    source={Images.downloadIcon}
                    style={styles.downloadIcon}
                  />
                </TouchableOpacity>
              </View>
            </LiquidGlassCard>
          </View>
        );
      })}
    </View>
  );
};

export default DocumentAttachmentViewer;

// These styles don't depend on theme, so they can stay outside
const viewerStyles = {
  pdfContainer: (borderRadius: number) => ({
    borderRadius,
    overflow: 'hidden' as const,
    width: '100%' as const,
  }),
  pdf: {flex: 1, width: '100%' as const},
  loader: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  docContainer: (borderRadius: number) => ({
    borderRadius,
    overflow: 'hidden' as const,
  }),
  unsupportedText: (color: string) => ({
    color,
    textAlign: 'center' as const,
    paddingHorizontal: 16,
  }),
  scrollTrack: (trackHeight: number) => ({
    position: 'absolute' as const,
    right: 4,
    top: 12,
    width: 4,
    height: trackHeight,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  }),
  scrollThumb: (color: string) => ({
    position: 'absolute' as const,
    right: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: color,
  }),
};
