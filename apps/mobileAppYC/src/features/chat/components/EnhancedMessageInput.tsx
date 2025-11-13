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
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Text,
} from 'react-native';
import {MessageInput, useChannelContext} from 'stream-chat-react-native';
import Sound from 'react-native-nitro-sound';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {
  pick as pickDocuments,
  types as DocumentPickerTypes,
  errorCodes as DocumentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerErrorWithCode,
} from '@react-native-documents/picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTheme} from '@/hooks';

export const EnhancedMessageInput: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const {channel} = useChannelContext();

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Request audio recording permission (Android)
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Recording Permission',
            message: 'This app needs access to your microphone to record voice messages.',
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

  // Start voice recording
  const startVoiceRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Please grant microphone permission to record voice messages.');
      return;
    }

    setIsRecordingLoading(true);
    ReactNativeHapticFeedback.trigger('impactMedium');

    try {
      // Set up recording progress listener
      Sound.addRecordBackListener((e) => {
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
        const response = await channel.sendFile(audioPath, 'voice-message.m4a', 'audio/m4a');

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

        for (const asset of result.assets) {
          if (asset.uri) {
            // Upload and send each image
            await channel.sendImage(asset.uri);
            ReactNativeHapticFeedback.trigger('notificationSuccess');
          }
        }
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

      if (result.assets && result.assets[0]?.uri && channel) {
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
        type: [DocumentPickerTypes.allFiles],
        allowMultiSelection: true,
      });

      if (result && result.length > 0 && channel) {
        ReactNativeHapticFeedback.trigger('impactMedium');

        for (const file of result) {
          if (!file.uri) {
            continue;
          }

          const fileName = file.name ?? 'Document';
          const mimeType = file.type ?? 'application/octet-stream';

          // Upload file to Stream
          const response = await channel.sendFile(file.uri, fileName, mimeType);

          // Send message with file attachment
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
        }

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
          onPress: pickImageFromGallery,
        },
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Send File',
          onPress: pickDocument,
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
      <View style={styles.recordingContainer}>
        <View style={styles.recordingInfo}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>
            Recording... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        <View style={styles.recordingActions}>
          <TouchableOpacity
            onPress={cancelVoiceRecording}
            style={[styles.recordButton, styles.cancelButton]}
            disabled={isRecordingLoading}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={stopVoiceRecording}
            style={[styles.recordButton, styles.stopButton]}
            disabled={isRecordingLoading}>
            {isRecordingLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Icon name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.actionsRow}>
        {/* Voice Message Button */}
        <TouchableOpacity
          onPress={startVoiceRecording}
          style={styles.actionButton}
          disabled={isRecordingLoading}>
          {isRecordingLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Icon name="mic" size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        {/* Attachment Button */}
        <TouchableOpacity onPress={showAttachmentOptions} style={styles.actionButton}>
          <Icon name="attach-file" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Default Stream Message Input */}
      <MessageInput />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background || '#fff',
    },
    actionsRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border || '#e0e0e0',
      gap: 12,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryTint || '#E6F0FE',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: '#f5f5f5',
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
    },
    recordingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    recordingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#ff0000',
    },
    recordingText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000',
    },
    recordingActions: {
      flexDirection: 'row',
      gap: 12,
    },
    recordButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: '#999',
    },
    stopButton: {
      backgroundColor: '#007AFF',
    },
  });

export default EnhancedMessageInput;
