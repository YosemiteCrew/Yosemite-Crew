import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Share,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
} from 'react-native';
import {WebView} from 'react-native-webview';
import Pdf from 'react-native-pdf';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import createAttachmentStyles from '@/shared/utils/attachmentStyles';
import type {DocumentFile} from '@/features/documents/types';
import {
  DOC_VIEWER_TYPES,
  isImageFile,
  isPdfFile,
  resolveSourceUri,
  buildDocViewerUri,
} from './documentAttachmentUtils';
import RNFS from 'react-native-fs';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
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

const PdfViewer: React.FC<{uri: string; fallback: React.ReactNode}> = ({uri, fallback}) => {
  const height = Math.max(Dimensions.get('window').height * 0.6, 400);
  const [shouldFallback, setShouldFallback] = React.useState(false);

  if (shouldFallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={[viewerStyles.pdfContainer, {height}]}>
      <Pdf
        source={{uri, cache: true}}
        style={viewerStyles.pdf}
        trustAllCerts={false}
        enablePaging
        enableAntialiasing
        spacing={4}
        renderActivityIndicator={() => (
          <View style={viewerStyles.loader}>
            <ActivityIndicator />
          </View>
        )}
        onError={error => {
          console.warn('[DocumentAttachmentViewer] PDF error', error);
          setShouldFallback(true);
        }}
      />
    </View>
  );
};

const DocViewer: React.FC<{uri: string; fallback?: React.ReactNode}> = ({uri, fallback}) => {
  const height = Math.max(Dimensions.get('window').height * 0.6, 400);
  const [hasError, setHasError] = React.useState(false);
  if (hasError && fallback) {
    return <>{fallback}</>;
  }
  const officeUri = buildDocViewerUri(uri);
  return (
    <View style={[viewerStyles.docContainer, {height}]}>
      <WebView
        style={viewerStyles.webview}
        source={{uri: officeUri}}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowFileAccess
        startInLoadingState
        mixedContentMode="always"
        onError={error => {
          console.warn('[DocumentAttachmentViewer] Doc viewer error', error);
          setHasError(true);
        }}
      />
    </View>
  );
};

export interface DocumentAttachmentViewerProps {
  attachments: DocumentFile[];
  documentTitle?: string;
  companionName?: string | null;
}

export const DocumentAttachmentViewer: React.FC<DocumentAttachmentViewerProps> = ({
  attachments,
  documentTitle,
  companionName,
}) => {
  const {theme} = useTheme();
  const styles = createAttachmentStyles(theme);

  if (!attachments?.length) {
    return (
      <View style={styles.emptyStateContainer}>
        <Image source={Images.documentIcon} style={styles.emptyStateIcon} />
        <Text style={styles.emptyStateTitle}>No attachments available</Text>
        <Text style={styles.emptyStateSubtitle}>Uploaded files will appear here</Text>
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
      const message = error instanceof Error ? error.message : 'Failed to share';
      Alert.alert('Error', message);
    }
  };

  const ensureStoragePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }
    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(permission);
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
        Alert.alert('Permission needed', 'Please grant storage permission to download files.');
        return;
      }

      const extension =
        (file.type && MIME_EXTENSION_MAP[file.type]) || file.type?.split('/').pop() || 'bin';
      const safeName = (file.name || 'document').replace(/[\\/:]/g, '_');
      const fileName = safeName.toLowerCase().endsWith(`.${extension}`)
        ? safeName
        : `${safeName}.${extension}`;
      const downloadDir = RNFS.DownloadDirectoryPath ?? RNFS.DocumentDirectoryPath;
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

  return (
    <View style={{gap: theme.spacing[6]}}>
      {attachments.map(file => {
        const sourceUri = resolveSourceUri(file);
        const canPreview = Boolean(sourceUri);
        const isPdf = isPdfFile(file.type);
        const isDoc = DOC_VIEWER_TYPES.has(file.type ?? '');
        const placeholder = renderPlaceholder(
          canPreview
            ? 'Preview unavailable right now. Try downloading or check back later.'
            : 'File is missing or the link is broken.',
        );

        return (
          <View key={file.id} style={styles.previewCard}>
            <View style={styles.previewCardHeader}>
              <Text style={styles.pdfLabel}>{file.name}</Text>
            </View>

            {isImageFile(file.type) && sourceUri ? (
              <Image source={{uri: sourceUri}} style={styles.previewImage} resizeMode="contain" />
            ) : isPdf && sourceUri ? (
              <PdfViewer uri={sourceUri} fallback={placeholder} />
            ) : isDoc && sourceUri ? (
              <DocViewer uri={sourceUri} fallback={placeholder} />
            ) : (
              placeholder
            )}

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
                <Image source={Images.downloadIcon} style={styles.downloadIcon} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default DocumentAttachmentViewer;

const viewerStyles = StyleSheet.create({
  pdfContainer: {borderRadius: 16, overflow: 'hidden', width: '100%'},
  pdf: {flex: 1, width: '100%'},
  loader: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  docContainer: {borderRadius: 16, overflow: 'hidden'},
  webview: {flex: 1},
});
