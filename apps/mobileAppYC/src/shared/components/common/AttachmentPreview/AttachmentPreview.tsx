import React from 'react';
import {View, Image, Text, Alert, Share} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import createAttachmentStyles from '@/shared/utils/attachmentStyles';

type AttachmentShape = {
  id: string;
  s3Url?: string;
  uri?: string;
  type?: string;
  name?: string;
};

type Props = {
  attachments: AttachmentShape[];
};

const handleShare = async (fileUrl?: string) => {
  try {
    await Share.share({
      message: 'Shared file',
      url: fileUrl ?? '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to share';
    Alert.alert('Error', message);
  }
};

export const AttachmentPreview: React.FC<Props> = ({attachments}) => {
  const {theme} = useTheme();
  const styles = createAttachmentStyles(theme);

  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      {attachments.map((file, index) => {
        const isImage =
          typeof file.type === 'string' && file.type.startsWith('image/');
        const sourceUri = file.s3Url ?? file.uri;
        return (
          <View key={file.id} style={styles.previewCard}>
            {isImage && sourceUri ? (
              <Image
                source={{uri: sourceUri}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.pdfPlaceholder}>
                <Image source={Images.documentIcon} style={styles.pdfIcon} />
                <Text style={styles.pdfLabel}>{file.name}</Text>
              </View>
            )}
            <Text style={styles.pageIndicator}>
              Page {index + 1} of {attachments.length}
            </Text>
            <PressableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(sourceUri)}>
              <Image source={Images.shareIcon} style={styles.shareIcon} />
            </PressableOpacity>
          </View>
        );
      })}
    </View>
  );
};

export default AttachmentPreview;
