/**
 * Enhanced Message Component with Copy, Share, and Haptic Feedback
 *
 * Features:
 * - Long press to show action sheet
 * - Copy message to clipboard
 * - Share message
 * - Delete message (for own messages)
 * - Reply to message
 * - Haptic feedback on all interactions
 */

import React from 'react';
import {Alert, ActionSheetIOS, Platform, TouchableWithoutFeedback, View} from 'react-native';
import {MessageSimple, useMessageContext} from 'stream-chat-react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Share from 'react-native-share';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Toast} from 'toastify-react-native';

export const EnhancedMessage: React.FC = () => {
  const {channel, message, isMyMessage, setQuotedMessage} = useMessageContext();

  const handleLongPress = () => {
    // Trigger haptic feedback
    ReactNativeHapticFeedback.trigger('impactMedium');

    const messageText = message.text || '';
    const hasText = messageText.length > 0;

    const options = [];
    const handlers: (() => void)[] = [];

    // Copy option
    if (hasText) {
      options.push('Copy Message');
      handlers.push(() => {
        Clipboard.setString(messageText);
        ReactNativeHapticFeedback.trigger('notificationSuccess');
        Toast.success('Message copied to clipboard');
      });
    }

    // Share option
    if (hasText) {
      options.push('Share Message');
      handlers.push(() => {
        ReactNativeHapticFeedback.trigger('impactLight');
        Share.open({
          message: messageText,
        }).catch(() => {
          // User cancelled
        });
      });
    }

    // Reply option
    options.push('Reply');
    handlers.push(() => {
      ReactNativeHapticFeedback.trigger('impactLight');
      setQuotedMessage?.(message);
    });

    // Delete option (only for own messages)
    if (isMyMessage) {
      options.push('Delete Message');
      const confirmDeleteMessage = async () => {
        ReactNativeHapticFeedback.trigger('notificationWarning');
        try {
          if (channel && message.id) {
            await channel.getClient().deleteMessage(message.id);
          }
          Toast.success('Message deleted');
        } catch (error) {
          console.error('Failed to delete message:', error);
          Toast.error('Failed to delete message');
        }
      };

      handlers.push(() => {
        ReactNativeHapticFeedback.trigger('impactMedium');
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => ReactNativeHapticFeedback.trigger('impactLight'),
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                confirmDeleteMessage();
              },
            },
          ],
        );
      });
    }

    // Cancel option
    options.push('Cancel');

    // Show action sheet
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: isMyMessage ? options.length - 2 : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex < handlers.length) {
            handlers[buttonIndex]();
          }
        },
      );
    } else {
      // Android
      Alert.alert(
        'Message Options',
        '',
        [
          ...options.slice(0, -1).map((option, index) => ({
            text: option,
            onPress: handlers[index],
            style: option === 'Delete Message' ? ('destructive' as const) : ('default' as const),
          })),
          {
            text: 'Cancel',
            style: 'cancel' as const,
          },
        ],
        {cancelable: true},
      );
    }
  };

  return (
    <TouchableWithoutFeedback onLongPress={handleLongPress}>
      <View>
        <MessageSimple />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default EnhancedMessage;
