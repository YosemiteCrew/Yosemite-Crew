/**
 * Custom Attachment Renderer
 *
 * Handles rendering of different attachment types:
 * - Audio (voice messages) with Nitro Sound player
 * - Video with react-native-video
 * - Images (default Stream handling)
 * - Files (default Stream handling)
 */

import React from 'react';
import {View, StyleSheet, Text, TouchableOpacity, Dimensions} from 'react-native';
import {Attachment, useMessageContext} from 'stream-chat-react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {VoiceMessagePlayer} from './VoiceMessagePlayer';
import {useTheme} from '@/hooks';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH * 0.7;

export const CustomAttachment: React.FC = () => {
  const {message} = useMessageContext();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [videoPaused, setVideoPaused] = React.useState(true);

  if (!message.attachments || message.attachments.length === 0) {
    return null;
  }

  const attachment = message.attachments[0];
  const attachmentType = attachment.type;

  // Handle audio attachments (voice messages)
  if (attachmentType === 'audio' && attachment.asset_url) {
    const duration =
      attachment.duration && typeof attachment.duration === 'number'
        ? attachment.duration * 1000
        : undefined;
    return (
      <View style={styles.audioContainer}>
        <VoiceMessagePlayer audioUrl={attachment.asset_url} duration={duration} />
      </View>
    );
  }

  // Handle video attachments
  if (attachmentType === 'video' && attachment.asset_url) {
    return (
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('impactLight');
          setVideoPaused(!videoPaused);
        }}
        activeOpacity={0.9}>
        <Video
          source={{uri: attachment.asset_url}}
          style={styles.video}
          resizeMode="cover"
          paused={videoPaused}
          controls={false}
          repeat={false}
        />
        {videoPaused && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Icon name="play-arrow" size={40} color={theme.colors.white} />
            </View>
          </View>
        )}
        <View style={styles.videoInfo}>
          <Icon name="videocam" size={16} color={theme.colors.white} />
          <Text style={styles.videoText}>
            {attachment.title || 'Video'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Handle file attachments with custom UI
  if (attachmentType === 'file' && attachment.asset_url) {
    const fileName = attachment.title || 'File';
    const fileSize =
      typeof attachment.file_size === 'number'
        ? `${(attachment.file_size / 1024).toFixed(1)} KB`
        : undefined;

    return (
      <TouchableOpacity
        style={styles.fileContainer}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('impactLight');
          // Open file (you can add Linking.openURL here)
        }}>
        <View style={styles.fileIcon}>
          <Icon name="insert-drive-file" size={32} color={theme.colors.primary} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          {fileSize && <Text style={styles.fileSize}>{fileSize}</Text>}
        </View>
        <Icon name="download" size={24} color={theme.colors.primary} />
      </TouchableOpacity>
    );
  }

  // Default rendering for images and other types
  return <Attachment attachment={attachment} />;
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    audioContainer: {
      marginVertical: theme.spacing['1'],
    },
    videoContainer: {
      width: MAX_WIDTH,
      height: MAX_WIDTH * 0.75,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.black,
      position: 'relative',
    },
    video: {
      width: '100%',
      height: '100%',
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.overlay,
    },
    playButton: {
      width: theme.spacing['14'],
      height: theme.spacing['14'],
      borderRadius: theme.borderRadius.lg,
      backgroundColor: 'rgba(255,255,255,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoInfo: {
      position: 'absolute',
      bottom: theme.spacing['2'],
      left: theme.spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.md,
    },
    videoText: {
      color: theme.colors.white,
      ...theme.typography.labelSmall,
    },
    fileContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing['3'],
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing['3'],
      maxWidth: MAX_WIDTH,
    },
    fileIcon: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.base,
      backgroundColor: theme.colors.primaryTint,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileInfo: {
      flex: 1,
      gap: theme.spacing['0'],
    },
    fileName: {
      ...theme.typography.bodySmall,
      fontWeight: '600',
      color: theme.colors.secondary,
    },
    fileSize: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
  });

export default CustomAttachment;
