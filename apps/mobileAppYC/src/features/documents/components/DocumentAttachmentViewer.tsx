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
  isDocViewerFile,
  isImageFile,
  isPdfFile,
  resolveSourceUri,
  buildDocViewerUri,
  buildGoogleDocsViewerUri,
} from './documentAttachmentUtils';
import RNFS from 'react-native-fs';
import {normalizeMimeType} from '@/shared/utils/mime';

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

const DocViewer: React.FC<{uri: string; fallback?: React.ReactNode; fileName?: string}> = ({uri, fallback, fileName}) => {
  const height = Math.max(Dimensions.get('window').height * 0.6, 400);
  const [hasError, setHasError] = React.useState(false);
  const [useGoogleViewer, setUseGoogleViewer] = React.useState(false);
  const contentLoadedRef = React.useRef({loaded: false});

  React.useEffect(() => {
    console.log('[DocumentAttachmentViewer] DocViewer loading', {
      fileName,
      sourceUri: uri,
      officeUri: buildDocViewerUri(uri),
    });
    contentLoadedRef.current.loaded = false;
  }, [uri, fileName]);

  // Detect blank/empty content and switch to Google Viewer after timeout
  React.useEffect(() => {
    if (useGoogleViewer) return; // Already switched

    const timeoutId = setTimeout(() => {
      if (!contentLoadedRef.current.loaded) {
        console.warn('[DocumentAttachmentViewer] Office Online Viewer appears blank, switching to Google Docs');
        setUseGoogleViewer(true);
      }
    }, 5000); // Wait 5 seconds for content to load

    return () => clearTimeout(timeoutId);
  }, [useGoogleViewer]);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  const officeUri = buildDocViewerUri(uri);
  const googleUri = buildGoogleDocsViewerUri(uri);
  const viewerUri = useGoogleViewer ? googleUri : officeUri;

  return (
    <View style={[viewerStyles.docContainer, {height}]}>
      <WebView
        style={viewerStyles.webview}
        source={{uri: viewerUri}}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        allowFileAccess
        startInLoadingState
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        onError={error => {
          console.error('[DocumentAttachmentViewer] Doc viewer error', {
            fileName,
            error,
            sourceUri: uri,
            viewer: useGoogleViewer ? 'google-docs' : 'office-online',
          });
          // Try fallback viewer
          if (useGoogleViewer) {
            setHasError(true);
          } else {
            console.log('[DocumentAttachmentViewer] Error detected, switching to Google Docs Viewer');
            setUseGoogleViewer(true);
          }
        }}
        onLoadStart={() => {
          console.log('[DocumentAttachmentViewer] Doc viewer loading started', {
            fileName,
            viewer: useGoogleViewer ? 'google-docs' : 'office-online',
          });
          contentLoadedRef.current.loaded = false;
        }}
        onLoadEnd={() => {
          contentLoadedRef.current.loaded = true;
          console.log('[DocumentAttachmentViewer] Doc viewer loaded successfully', {
            fileName,
            viewer: useGoogleViewer ? 'google-docs' : 'office-online',
          });
        }}
        onMessage={(event) => {
          console.log('[DocumentAttachmentViewer] WebView message', event.nativeEvent.data);
          contentLoadedRef.current.loaded = true;
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
        Alert.alert('Permission needed', 'Please grant storage permission to download files.');
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
        const isDoc = isDocViewerFile(file.type);
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

            {(() => {
              if (isImageFile(file.type) && sourceUri) {
                return <Image source={{uri: sourceUri}} style={styles.previewImage} resizeMode="contain" />;
              }
              if (isPdf && sourceUri) {
                return <PdfViewer uri={sourceUri} fallback={placeholder} />;
              }
              if (isDoc && sourceUri) {
                return <DocViewer uri={sourceUri} fallback={placeholder} fileName={file.name} />;
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
