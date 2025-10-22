import React, {useMemo} from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {DocumentFile} from '@/types/document.types';

interface DocumentAttachmentsSectionProps {
  files: DocumentFile[];
  onAddPress: () => void;
  onRequestRemove: (file: DocumentFile) => void;
  error?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

const DEFAULT_EMPTY_TITLE = 'Upload documents';
const DEFAULT_EMPTY_SUBTITLE =
  'Only DOC, PDF, PNG, JPEG formats\nwith max size 5 MB';

const resolvePreviewSource = (file: DocumentFile) =>
  file.uri ?? (file as {s3Url?: string}).s3Url ?? null;

export const DocumentAttachmentsSection: React.FC<
  DocumentAttachmentsSectionProps
> = ({
  files,
  onAddPress,
  onRequestRemove,
  error,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptySubtitle = DEFAULT_EMPTY_SUBTITLE,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderPreviewTile = (file: DocumentFile) => {
    const sourceUri = resolvePreviewSource(file);
    const isImage = typeof file.type === 'string' && file.type.startsWith('image/');

    return (
      <View key={file.id} style={styles.filePreviewBox}>
        {isImage && sourceUri ? (
          <Image
            source={{uri: sourceUri}}
            style={styles.filePreviewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.filePlaceholder}>
            <Image source={Images.documentIcon} style={styles.filePlaceholderIcon} />
            <Text style={styles.filePlaceholderText} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRequestRemove(file)}
          activeOpacity={0.7}>
          <Image source={Images.closeIcon} style={styles.removeIcon} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      {files.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyStateContainer}
          onPress={onAddPress}
          activeOpacity={0.7}>
          <Image source={Images.uploadIcon} style={styles.emptyStateIcon} />
          <Text style={styles.emptyStateTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyStateSubtitle}>{emptySubtitle}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.filesPreviewContainer}>
          <View style={styles.multipleFilesGrid}>
            {files.map(renderPreviewTile)}
            <TouchableOpacity
              style={styles.addMoreBox}
              onPress={onAddPress}
              activeOpacity={0.7}>
              <Image source={Images.addIconWhite} style={styles.addMoreIcon} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    emptyStateContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing['6'],
      paddingHorizontal: theme.spacing['5'],
      alignItems: 'center',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.surface,
    },
    emptyStateIcon: {
      width: 48,
      height: 48,
      resizeMode: 'contain',
      marginBottom: theme.spacing['2'],
    },
    emptyStateTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    filesPreviewContainer: {
      marginBottom: theme.spacing['2'],
    },
    multipleFilesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing['2'],
    },
    filePreviewBox: {
      width: 96,
      height: 96,
      borderRadius: theme.borderRadius.base,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    filePreviewImage: {
      width: '100%',
      height: '100%',
    },
    filePlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['2'],
      backgroundColor: theme.colors.surface,
      gap: theme.spacing['2'],
    },
    filePlaceholderIcon: {
      width: 32,
      height: 32,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    filePlaceholderText: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    addMoreBox: {
      width: 96,
      height: 96,
      borderRadius: theme.borderRadius.base,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addMoreIcon: {
      width: 28,
      height: 28,
      tintColor: theme.colors.white,
      resizeMode: 'contain',
    },
    removeButton: {
      position: 'absolute',
      top: theme.spacing['2'],
      right: theme.spacing['2'],
      width: 24,
      height: 24,
      borderRadius: 12,
      opacity: 0.6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },
    errorText: {
      marginTop: theme.spacing['2'],
      ...theme.typography.labelXsBold,
      color: theme.colors.error,
    },
  });

export default DocumentAttachmentsSection;
