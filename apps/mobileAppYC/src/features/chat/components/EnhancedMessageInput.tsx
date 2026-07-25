/**
 * Enhanced Message Input with Voice Recording, Image Picker, and File Attachments
 *
 * Features:
 * - Voice message recording using Nitro Sound
 * - Image picker from camera roll
 * - Camera capture
 * - File attachments
 * - Haptic feedback on interactions
 */

import React, {useState} from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Text,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {MessageInput, useChannelContext} from 'stream-chat-react-native';
import Sound from 'react-native-nitro-sound';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {
  pick as pickDocuments,
  errorCodes as DocumentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerErrorWithCode,
} from '@react-native-documents/picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {ALLOWED_FILE_TYPES} from '@/features/documents/constants';
import {normalizeMimeType} from '@/shared/utils/mime';

// Request audio recording permission (Android)
const requestAudioPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Audio Recording Permission',
          message:
            'This app needs access to your microphone to record voice messages.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

export const EnhancedMessageInput: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {channel} = useChannelContext();

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Start voice recording
  const startVoiceRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Please grant microphone permission to record voice messages.',
      );
      return;
    }

    setIsRecordingLoading(true);
    ReactNativeHapticFeedback.trigger('impactMedium');

    try {
      // Set up recording progress listener
      Sound.addRecordBackListener(e => {
        setRecordingDuration(Math.floor(e.currentPosition / 1000));
      });

      await Sound.startRecorder();
      setIsRecording(true);
      ReactNativeHapticFeedback.trigger('notificationSuccess');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    } finally {
      setIsRecordingLoading(false);
    }
  };

  // Stop voice recording and send
  const stopVoiceRecording = async () => {
    setIsRecordingLoading(true);
    ReactNativeHapticFeedback.trigger('impactMedium');

    try {
      const audioPath = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setIsRecording(false);
      setRecordingDuration(0);

      if (audioPath && channel) {
        // Upload audio file to Stream
        const response = await channel.sendFile(
          audioPath,
          'voice-message.m4a',
          'audio/m4a',
        );

        // Send message with audio attachment
        await channel.sendMessage({
          text: `🎤 Voice message (${recordingDuration}s)`,
          attachments: [
            {
              type: 'audio',
              asset_url: response.file,
              duration: recordingDuration,
              mime_type: 'audio/m4a',
            },
          ],
        });

        ReactNativeHapticFeedback.trigger('notificationSuccess');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setIsRecordingLoading(false);
    }
  };

  // Cancel voice recording
  const cancelVoiceRecording = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');
    try {
      await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  // Pick image from gallery
  const pickImageFromGallery = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 5, // Allow multiple images
      });

      if (result.assets && result.assets.length > 0 && channel) {
        ReactNativeHapticFeedback.trigger('impactMedium');

        const imageUris = result.assets
          .map(asset => asset.uri)
          .filter((uri): uri is string => Boolean(uri));

        if (imageUris.length === 0) {
          return;
        }

        await Promise.all(imageUris.map(uri => channel.sendImage(uri)));
        ReactNativeHapticFeedback.trigger('notificationSuccess');
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');

    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      });

      if (result.assets?.[0]?.uri && channel) {
        ReactNativeHapticFeedback.trigger('impactMedium');
        await channel.sendImage(result.assets[0].uri);
        ReactNativeHapticFeedback.trigger('notificationSuccess');
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Pick and send document
  const pickDocument = async () => {
    ReactNativeHapticFeedback.trigger('impactLight');

    try {
      const result = await pickDocuments({
        type: ALLOWED_FILE_TYPES,
        allowMultiSelection: true,
      });

      if (result && result.length > 0 && channel) {
        const allowedFiles = result.filter(
          file =>
            Boolean(file.uri) &&
            ALLOWED_FILE_TYPES.includes(normalizeMimeType(file.type)),
        );

        if (allowedFiles.length === 0) {
          Alert.alert(
            'Unsupported file',
            'That file type is not supported. Please choose a photo or document instead.',
          );
          return;
        }

        ReactNativeHapticFeedback.trigger('impactMedium');

        await Promise.all(
          allowedFiles.map(file => {
            const fileUri = file.uri as string;
            return (async () => {
              const fileName = file.name ?? 'Document';
              const mimeType = normalizeMimeType(file.type);

              const response = await channel.sendFile(
                fileUri,
                fileName,
                mimeType,
              );

              await channel.sendMessage({
                text: `📎 ${fileName}`,
                attachments: [
                  {
                    type: 'file',
                    asset_url: response.file,
                    title: fileName,
                    mime_type: mimeType,
                    file_size: file.size ?? undefined,
                  },
                ],
              });
            })();
          }),
        );

        ReactNativeHapticFeedback.trigger('notificationSuccess');
      }
    } catch (error) {
      if (
        isDocumentPickerErrorWithCode(error) &&
        error.code === DocumentPickerErrorCodes.OPERATION_CANCELED
      ) {
        return;
      }

      console.error('Failed to pick document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  // Show attachment options
  const showAttachmentOptions = () => {
    ReactNativeHapticFeedback.trigger('impactLight');

    Alert.alert(
      'Send Attachment',
      'Choose an option',
      [
        {
          text: 'Photo from Gallery',
          onPress: () => {
            pickImageFromGallery();
          },
        },
        {
          text: 'Take Photo',
          onPress: () => {
            takePhoto();
          },
        },
        {
          text: 'Send File',
          onPress: () => {
            pickDocument();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      {cancelable: true},
    );
  };

  // Voice recording UI
  if (isRecording) {
    return (
      <RecordingBar
        styles={styles}
        theme={theme}
        recordingDuration={recordingDuration}
        isRecordingLoading={isRecordingLoading}
        onCancel={cancelVoiceRecording}
        onStop={stopVoiceRecording}
      />
    );
  }

  return (
    <ComposerBar
      styles={styles}
      theme={theme}
      isRecordingLoading={isRecordingLoading}
      onStartRecording={startVoiceRecording}
      onShowAttachmentOptions={showAttachmentOptions}
    />
  );
};

interface RecordingBarProps {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  recordingDuration: number;
  isRecordingLoading: boolean;
  onCancel: () => void;
  onStop: () => void;
}

// Active voice-recording bar: elapsed timer plus cancel/send controls.
const RecordingBar: React.FC<RecordingBarProps> = ({
  styles,
  theme,
  recordingDuration,
  isRecordingLoading,
  onCancel,
  onStop,
}) => (
  <View style={styles.recordingContainer}>
    <View style={styles.recordingInfo}>
      <View style={styles.recordingDot} />
      <Text style={styles.recordingText}>
        Recording... {Math.floor(recordingDuration / 60)}:
        {(recordingDuration % 60).toString().padStart(2, '0')}
      </Text>
    </View>
    <View style={styles.recordingActions}>
      <PressableOpacity
        onPress={() => {
          onCancel();
        }}
        style={[styles.recordButton, styles.cancelButton]}
        disabled={isRecordingLoading}
        accessibilityRole="button"
        accessibilityLabel="Cancel recording"
        accessibilityState={{disabled: isRecordingLoading}}>
        <Icon name="close" size={24} color={theme.colors.inkBody} />
      </PressableOpacity>
      <PressableOpacity
        onPress={() => {
          onStop();
        }}
        style={[styles.recordButton, styles.stopButton]}
        disabled={isRecordingLoading}
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        accessibilityState={{disabled: isRecordingLoading}}>
        {isRecordingLoading ? (
          <ActivityIndicator color={theme.colors.ctaText} />
        ) : (
          <Icon name="send" size={24} color={theme.colors.ctaText} />
        )}
      </PressableOpacity>
    </View>
  </View>
);

interface ComposerBarProps {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  isRecordingLoading: boolean;
  onStartRecording: () => void;
  onShowAttachmentOptions: () => void;
}

// Idle composer: voice + attachment actions above the Stream message input.
const ComposerBar: React.FC<ComposerBarProps> = ({
  styles,
  theme,
  isRecordingLoading,
  onStartRecording,
  onShowAttachmentOptions,
}) => (
  <View style={styles.container}>
    <View style={styles.actionsRow}>
      {/* Voice Message Button */}
      <PressableOpacity
        onPress={() => {
          onStartRecording();
        }}
        style={styles.actionButton}
        disabled={isRecordingLoading}
        accessibilityRole="button"
        accessibilityLabel="Record voice message"
        accessibilityState={{disabled: isRecordingLoading}}>
        {isRecordingLoading ? (
          <ActivityIndicator size="small" color={theme.colors.blueText} />
        ) : (
          <Icon name="mic" size={24} color={theme.colors.blueText} />
        )}
      </PressableOpacity>

      {/* Attachment Button */}
      <PressableOpacity
        onPress={onShowAttachmentOptions}
        style={styles.actionButton}
        accessibilityRole="button"
        accessibilityLabel="Add attachment">
        <Icon name="attach-file" size={24} color={theme.colors.blueText} />
      </PressableOpacity>
    </View>

    {/* Default Stream Message Input */}
    <MessageInput />
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.screen,
    },
    actionsRow: {
      flexDirection: 'row',
      paddingHorizontal: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
      borderTopWidth: 1,
      borderTopColor: theme.colors.hairline,
      gap: theme.spacing['3'],
    },
    actionButton: {
      width: theme.spacing['10'],
      height: theme.spacing['10'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing['4'],
      backgroundColor: theme.colors.screen2,
      borderTopWidth: 1,
      borderTopColor: theme.colors.hairline,
    },
    recordingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
    },
    recordingDot: {
      width: theme.spacing['3'],
      height: theme.spacing['3'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.danger,
    },
    recordingText: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.ink,
    },
    recordingActions: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
    },
    recordButton: {
      width: theme.spacing['12'],
      height: theme.spacing['12'],
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    stopButton: {
      backgroundColor: theme.colors.cta,
    },
  });

export default EnhancedMessageInput;
