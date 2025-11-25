import React from 'react';
import {View, Image, Text, TouchableOpacity, Alert, Share} from 'react-native';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import createAttachmentStyles from '@/shared/utils/attachmentStyles';

type AttachmentShape = {
  id: string;
  s3Url?: string;
  uri?: string;
  type?: string;
  name?: string;
  viewUrl?: string;
  downloadUrl?: string;
};

type Props = {
  attachments: AttachmentShape[];
  documentTitle?: string;
  companionName?: string | null;
};

export const AttachmentPreview: React.FC<Props> = ({
  attachments,
  documentTitle,
  companionName,
}) => {
  const {theme} = useTheme();
  const styles = createAttachmentStyles(theme);

  const resolveSourceUri = (file: AttachmentShape) =>
    file.viewUrl ?? file.s3Url ?? file.downloadUrl ?? file.uri;

  const buildShareLabel = (fileName?: string) => {
    const title = documentTitle || fileName || 'Document';
    if (companionName) {
      return `${title} for ${companionName}`;
    }
    return title;
  };

  const handleShare = async (file: AttachmentShape) => {
    const fileUrl = resolveSourceUri(file);
    const shareLabel = buildShareLabel(file.name);
    const shareMessage = fileUrl
      ? `${shareLabel}\n\n${fileUrl}`
      : shareLabel;

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

  if (!attachments || attachments.length === 0) return null;

  return (
  <View style={styles.container}>
      {attachments.map((file, index) => {
        const isImage = typeof file.type === 'string' && file.type.startsWith('image/');
        const sourceUri = resolveSourceUri(file);
        return (
          <View key={file.id} style={styles.previewCard}>
            {isImage && sourceUri ? (
              <Image source={{uri: sourceUri}} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <View style={styles.pdfPlaceholder}>
                <Image source={Images.documentIcon} style={styles.pdfIcon} />
                <Text style={styles.pdfLabel}>{file.name || 'Document'}</Text>
              </View>
            )}
            <Text style={styles.pageIndicator}>Document {index + 1} of {attachments.length}</Text>
            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare(file)}>
              <Image source={Images.shareIcon} style={styles.shareIcon} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

  export default AttachmentPreview;
