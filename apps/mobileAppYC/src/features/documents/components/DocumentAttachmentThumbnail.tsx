import React from 'react';
import {View, Text, Image, TouchableOpacity} from 'react-native';
import {Images} from '@/assets/images';
import type {DocumentFile} from '@/features/documents/types';
import {
  useThumbStyles,
  resolveThumbSource,
  resolveThumbLabel,
} from './documentAttachmentUtils';

interface Props {
  file: DocumentFile;
  index: number;
  total: number;
  onShare: (file: DocumentFile) => void;
}

export const DocumentAttachmentThumbnail: React.FC<Props> = ({
  file,
  index,
  total,
  onShare,
}) => {
  const {styles} = useThumbStyles();
  const {isImage, source} = resolveThumbSource(file);

  return (
    <View style={styles.previewCard}>
      {isImage && source ? (
        <Image source={{uri: source}} style={styles.previewImage} resizeMode="contain" />
      ) : (
        <View style={styles.pdfPlaceholder}>
          <Image source={Images.documentIcon} style={styles.pdfIcon} />
          <Text style={styles.pdfLabel}>{resolveThumbLabel(file)}</Text>
        </View>
      )}
      <Text style={styles.pageIndicator}>
        Document {index + 1} of {total}
      </Text>
      <TouchableOpacity
        style={styles.shareButton}
        onPress={() => onShare(file)}
        accessibilityRole="button"
        accessibilityLabel="Share attachment">
        <Image source={Images.shareIcon} style={styles.shareIcon} />
      </TouchableOpacity>
    </View>
  );
};

export default DocumentAttachmentThumbnail;
