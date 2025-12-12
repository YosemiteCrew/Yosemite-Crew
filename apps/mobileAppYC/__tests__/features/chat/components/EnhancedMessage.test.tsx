import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {EnhancedMessage} from '@/features/chat/components/EnhancedMessage';
import {useMessageContext} from 'stream-chat-react-native';
import {Alert, Platform, ActionSheetIOS} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Share from 'react-native-share';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Toast} from 'toastify-react-native';

// --- Mocks ---

// 1. Mock Stream Chat Context
jest.mock('stream-chat-react-native', () => {
  const {View: RNView, Text: RNText} = require('react-native');
  return {
    MessageSimple: () => (
      <RNView>
        <RNText>MessageSimple</RNText>
      </RNView>
    ),
    useMessageContext: jest.fn(),
  };
});

// 2. Mock Native Modules
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-share', () => ({
  open: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('toastify-react-native', () => ({
  Toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// 3. Mock React Native ActionSheetIOS specifically
// We mock it directly on the import to ensure the component uses our mock.
// Since we are inside the test file, we can't easily mock 'react-native' entirely without affecting other imports.
// However, the standard Jest way for methods usually works if the object exists.
// If ActionSheetIOS is undefined, we need to mock the underlying NativeModule or force the object existence.

// Force mock ActionSheetIOS properties
ActionSheetIOS.showActionSheetWithOptions = jest.fn();

// Spy on Alert
jest.spyOn(Alert, 'alert');

describe('EnhancedMessage', () => {
  // Common Mock Data
  const mockSetQuotedMessage = jest.fn();
  const mockDeleteMessage = jest.fn();
  const mockChannel = {
    getClient: () => ({deleteMessage: mockDeleteMessage}),
  };

  const baseContext = {
    channel: mockChannel,
    message: {id: 'msg-1', text: 'Hello World'},
    isMyMessage: false,
    setQuotedMessage: mockSetQuotedMessage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS
    (useMessageContext as jest.Mock).mockReturnValue(baseContext);

    // Reset the mock implementation for each test to ensure clean state
    (ActionSheetIOS.showActionSheetWithOptions as jest.Mock).mockReset();
  });

  // --- Rendering ---
  it('renders the MessageSimple component', () => {
    const {getByText} = render(<EnhancedMessage />);
    expect(getByText('MessageSimple')).toBeTruthy();
  });

  // --- Interactions (iOS) ---
  describe('iOS ActionSheet Interactions', () => {
    it('shows action sheet on long press with correct options (not my message)', () => {
      const {getByText} = render(<EnhancedMessage />);

      fireEvent(getByText('MessageSimple'), 'longPress');

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactMedium',
      );
      expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          options: ['Copy Message', 'Share Message', 'Reply', 'Cancel'],
          cancelButtonIndex: 3,
        }),
        expect.any(Function),
      );
    });

    it('shows delete option if it is my message', () => {
      (useMessageContext as jest.Mock).mockReturnValue({
        ...baseContext,
        isMyMessage: true,
      });

      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          options: [
            'Copy Message',
            'Share Message',
            'Reply',
            'Delete Message',
            'Cancel',
          ],
          destructiveButtonIndex: 3, // Delete is second to last
        }),
        expect.any(Function),
      );
    });

    it('handles Copy Message action', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Simulate tapping option 0 (Copy)
      // We grab the callback function passed as the second argument
      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      callback(0);

      expect(Clipboard.setString).toHaveBeenCalledWith('Hello World');
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'notificationSuccess',
      );
      expect(Toast.success).toHaveBeenCalledWith('Message copied to clipboard');
    });

    it('handles Share Message action', async () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Simulate tapping option 1 (Share)
      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      callback(1);

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
      expect(Share.open).toHaveBeenCalledWith({message: 'Hello World'});
    });

    it('handles Share Message user cancellation', async () => {
      (Share.open as jest.Mock).mockRejectedValueOnce(
        new Error('User cancelled'),
      );
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      await callback(1); // Should catch error silently

      expect(Share.open).toHaveBeenCalled();
    });

    it('handles Reply action', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Simulate tapping option 2 (Reply)
      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      callback(2);

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
      expect(mockSetQuotedMessage).toHaveBeenCalledWith(baseContext.message);
    });

    it('handles interactions when message has no text (e.g. image only)', () => {
      (useMessageContext as jest.Mock).mockReturnValue({
        ...baseContext,
        message: {id: 'msg-2', text: ''}, // Empty text
      });

      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          // Copy and Share should be absent
          options: ['Reply', 'Cancel'],
        }),
        expect.any(Function),
      );
    });

    it('handles clicking Cancel button (index out of handlers bounds)', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      // 3 is cancel (Copy, Share, Reply, Cancel)
      // Handlers array length is 3. Index 3 is out of bounds for handlers array.
      callback(3);

      // No handlers called
      expect(Clipboard.setString).not.toHaveBeenCalled();
      expect(Share.open).not.toHaveBeenCalled();
    });
  });

  // --- Interactions (Android) ---
  describe('Android Alert Interactions', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('shows Alert on long press for Android', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      expect(Alert.alert).toHaveBeenCalledWith(
        'Message Options',
        '',
        expect.arrayContaining([
          expect.objectContaining({text: 'Copy Message'}),
          expect.objectContaining({text: 'Share Message'}),
          expect.objectContaining({text: 'Reply'}),
          expect.objectContaining({text: 'Cancel', style: 'cancel'}),
        ]),
        {cancelable: true},
      );
    });

    it('triggers handler when Alert option is pressed', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Get the buttons array passed to Alert.alert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];

      // Find Copy button and press it
      const copyBtn = buttons.find((b: any) => b.text === 'Copy Message');
      copyBtn.onPress();

      expect(Clipboard.setString).toHaveBeenCalledWith('Hello World');
    });

    it('sets destructive style for Delete Message on Android', () => {
      (useMessageContext as jest.Mock).mockReturnValue({
        ...baseContext,
        isMyMessage: true,
      });

      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteBtn = buttons.find((b: any) => b.text === 'Delete Message');

      expect(deleteBtn.style).toBe('destructive');
    });
  });

  // --- Delete Functionality (Complex Flow) ---
  describe('Delete Message Flow', () => {
    beforeEach(() => {
      (useMessageContext as jest.Mock).mockReturnValue({
        ...baseContext,
        isMyMessage: true,
      });
    });

    it('opens confirmation alert when Delete is selected', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Simulate selecting Delete (index 3: Copy, Share, Reply, Delete)
      const callback = (ActionSheetIOS.showActionSheetWithOptions as jest.Mock)
        .mock.calls[0][1];
      callback(3);

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactMedium',
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Message',
        'Are you sure you want to delete this message?',
        expect.any(Array),
      );
    });

    it('cancels deletion when Cancel is pressed in confirmation', () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Select Delete option
      const actionSheetCallback = (
        ActionSheetIOS.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0][1];
      actionSheetCallback(3);

      // Get Alert buttons
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelBtn = buttons.find((b: any) => b.text === 'Cancel');

      cancelBtn.onPress();

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });

    it('proceeds with deletion when Delete is pressed in confirmation', async () => {
      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      // Select Delete option
      const actionSheetCallback = (
        ActionSheetIOS.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0][1];
      actionSheetCallback(3);

      // Get Alert buttons
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteBtn = buttons.find((b: any) => b.text === 'Delete');

      await deleteBtn.onPress();

      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'notificationWarning',
      );
      expect(mockDeleteMessage).toHaveBeenCalledWith('msg-1');
      expect(Toast.success).toHaveBeenCalledWith('Message deleted');
    });

    it('handles delete error gracefully', async () => {
      mockDeleteMessage.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const {getByText} = render(<EnhancedMessage />);
      fireEvent(getByText('MessageSimple'), 'longPress');

      const actionSheetCallback = (
        ActionSheetIOS.showActionSheetWithOptions as jest.Mock
      ).mock.calls[0][1];
      actionSheetCallback(3);

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteBtn = buttons.find((b: any) => b.text === 'Delete');

      await deleteBtn.onPress();

      expect(Toast.error).toHaveBeenCalledWith('Failed to delete message');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
