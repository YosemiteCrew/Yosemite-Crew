import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act} from '@testing-library/react-native';
// Ensure this path matches exactly where you saved the component.
// If VS Code still complains, try restarting the TS server (Ctrl+Shift+P -> Restart TS Server)
import {EnhancedMessageInput} from '@/features/chat/components/EnhancedMessageInput';
import {
  Alert,
  Platform,
  PermissionsAndroid,
  // Error 4 Fixed: Removed unused ToastAndroid
} from 'react-native';
import Sound from 'react-native-nitro-sound';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {
  pick as pickDocuments,
  isErrorWithCode as isDocumentPickerErrorWithCode,
} from '@react-native-documents/picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useChannelContext} from 'stream-chat-react-native';

// --- Mocks ---

// 1. Mock Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock Stream Chat
const mockSendMessage = jest.fn();
const mockSendImage = jest.fn();
const mockSendFile = jest.fn();

jest.mock('stream-chat-react-native', () => {
  // Error 5 Fixed: Removed unused 'const React = require("react")'
  const {View} = require('react-native');
  return {
    MessageInput: () => <View testID="StreamMessageInput" />,
    useChannelContext: jest.fn(),
  };
});

// 3. Mock Native Modules
jest.mock('react-native-nitro-sound', () => ({
  startRecorder: jest.fn(),
  stopRecorder: jest.fn(),
  addRecordBackListener: jest.fn(),
  removeRecordBackListener: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {allFiles: 'allFiles'},
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: jest.fn(),
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

// 4. Mock Icon to render text for easier selection
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const {Text} = require('react-native');
  return ({name}: {name: string}) => <Text>{name}</Text>;
});

// --- Tests ---

describe('EnhancedMessageInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios'; // Default to iOS

    // Setup Stream Context Mock
    (useChannelContext as jest.Mock).mockReturnValue({
      channel: {
        sendMessage: mockSendMessage,
        sendImage: mockSendImage,
        sendFile: mockSendFile.mockResolvedValue({
          file: 'https://fake-url.com/file',
        }),
      },
    });

    // Default Sound Mocks
    (Sound.startRecorder as jest.Mock).mockResolvedValue(true);
    (Sound.stopRecorder as jest.Mock).mockResolvedValue('path/to/audio.m4a');
  });

  // --- Rendering ---

  it('renders idle state correctly', () => {
    const {getByTestId, getByText} = render(<EnhancedMessageInput />);
    expect(getByTestId('StreamMessageInput')).toBeTruthy();
    expect(getByText('mic')).toBeTruthy();
    expect(getByText('attach-file')).toBeTruthy();
  });

  // --- Voice Recording ---

  it('handles Android permission denial', async () => {
    Platform.OS = 'android';
    const spyRequest = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue('denied' as any);
    const spyAlert = jest.spyOn(Alert, 'alert');

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    expect(spyRequest).toHaveBeenCalled();
    expect(spyAlert).toHaveBeenCalledWith(
      'Permission Denied',
      expect.stringContaining('Please grant'),
    );
    expect(Sound.startRecorder).not.toHaveBeenCalled();
  });

  it('handles Android permission exception', async () => {
    Platform.OS = 'android';
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockRejectedValue(new Error('Perm Error'));
    const spyAlert = jest.spyOn(Alert, 'alert');

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(spyAlert).toHaveBeenCalledWith(
      'Permission Denied',
      expect.stringContaining('Please grant'),
    );
    consoleSpy.mockRestore();
  });

  it('starts recording successfully (Android Granted)', async () => {
    Platform.OS = 'android';
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    expect(Sound.startRecorder).toHaveBeenCalled();
    expect(getByText(/Recording.../)).toBeTruthy();
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      'notificationSuccess',
    );
  });

  it('handles start recording failure', async () => {
    (Sound.startRecorder as jest.Mock).mockRejectedValue(
      new Error('Start Failed'),
    );
    const spyAlert = jest.spyOn(Alert, 'alert');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Failed to start'),
    );
    consoleSpy.mockRestore();
  });

  it('updates recording duration via listener', async () => {
    let listener: any;
    (Sound.addRecordBackListener as jest.Mock).mockImplementation(cb => {
      listener = cb;
    });

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    act(() => {
      if (listener) listener({currentPosition: 65000});
    });

    expect(getByText('Recording... 1:05')).toBeTruthy();
  });

  it('stops recording and sends message', async () => {
    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    await act(async () => {
      fireEvent.press(getByText('send'));
    });

    expect(Sound.stopRecorder).toHaveBeenCalled();
    expect(mockSendFile).toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({type: 'audio', mime_type: 'audio/m4a'}),
        ]),
      }),
    );
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      'notificationSuccess',
    );
  });

  it('handles stop recording failure', async () => {
    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    (Sound.stopRecorder as jest.Mock).mockRejectedValue(
      new Error('Stop Failed'),
    );
    const spyAlert = jest.spyOn(Alert, 'alert');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await act(async () => {
      fireEvent.press(getByText('send'));
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Failed to send'),
    );
    consoleSpy.mockRestore();
  });

  it('cancels recording', async () => {
    const {getByText, queryByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    expect(queryByText(/Recording.../)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('close'));
    });

    expect(Sound.stopRecorder).toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(queryByText(/Recording.../)).toBeNull();
  });

  it('handles cancel recording error silently (logs only)', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (Sound.stopRecorder as jest.Mock).mockRejectedValue(
      new Error('Cancel Failed'),
    );

    const {getByText} = render(<EnhancedMessageInput />);

    await act(async () => {
      fireEvent.press(getByText('mic'));
    });

    await act(async () => {
      fireEvent.press(getByText('close'));
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to cancel recording:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  // --- Attachments & Image/File Picking ---

  const triggerAttachmentOption = async (optionIndex: number) => {
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByText} = render(<EnhancedMessageInput />);

    fireEvent.press(getByText('attach-file'));

    const alertButtons = spyAlert.mock.calls[0][2];
    if (
      alertButtons &&
      alertButtons[optionIndex] &&
      alertButtons[optionIndex].onPress
    ) {
      await act(async () => {
        // @ts-ignore
        await alertButtons[optionIndex].onPress();
      });
    }
  };

  it('picks image from gallery successfully', async () => {
    (launchImageLibrary as jest.Mock).mockResolvedValue({
      assets: [{uri: 'image-uri'}, {uri: 'image-uri-2'}],
    });

    await triggerAttachmentOption(0);

    expect(launchImageLibrary).toHaveBeenCalledWith(
      expect.objectContaining({selectionLimit: 5}),
    );
    expect(mockSendImage).toHaveBeenCalledTimes(2);
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      'notificationSuccess',
    );
  });

  it('handles image gallery failure', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert');
    (launchImageLibrary as jest.Mock).mockRejectedValue(
      new Error('Gallery Error'),
    );

    await triggerAttachmentOption(0);

    expect(consoleSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Failed to pick image'),
    );
    consoleSpy.mockRestore();
  });

  it('takes photo successfully', async () => {
    (launchCamera as jest.Mock).mockResolvedValue({
      assets: [{uri: 'camera-uri'}],
    });

    await triggerAttachmentOption(1);

    expect(launchCamera).toHaveBeenCalled();
    expect(mockSendImage).toHaveBeenCalledWith('camera-uri');
  });

  it('handles camera failure', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert');
    (launchCamera as jest.Mock).mockRejectedValue(new Error('Camera Error'));

    await triggerAttachmentOption(1);

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Failed to take photo'),
    );
    consoleSpy.mockRestore();
  });

  it('picks document successfully', async () => {
    (pickDocuments as jest.Mock).mockResolvedValue([
      {uri: 'doc-uri', name: 'test.pdf', type: 'application/pdf', size: 1024},
    ]);

    await triggerAttachmentOption(2);

    expect(pickDocuments).toHaveBeenCalled();
    expect(mockSendFile).toHaveBeenCalledWith(
      'doc-uri',
      'test.pdf',
      'application/pdf',
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('test.pdf'),
      }),
    );
  });

  it('handles document picker cancellation', async () => {
    const pickerError: any = new Error('Canceled');
    pickerError.code = 'OPERATION_CANCELED';
    // Error 2 Fixed: Double cast to unknown then jest.Mock
    (isDocumentPickerErrorWithCode as unknown as jest.Mock).mockReturnValue(
      true,
    );
    (pickDocuments as jest.Mock).mockRejectedValue(pickerError);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await triggerAttachmentOption(2);

    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('handles document picker error', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert');
    // Error 3 Fixed: Double cast to unknown then jest.Mock
    (isDocumentPickerErrorWithCode as unknown as jest.Mock).mockReturnValue(
      false,
    );
    (pickDocuments as jest.Mock).mockRejectedValue(new Error('Picker Fail'));

    await triggerAttachmentOption(2);

    expect(alertSpy).toHaveBeenLastCalledWith(
      'Error',
      expect.stringContaining('Failed to pick document'),
    );
    consoleSpy.mockRestore();
  });

  it('handles empty document selection (safeguard)', async () => {
    (pickDocuments as jest.Mock).mockResolvedValue([{uri: null}]);
    await triggerAttachmentOption(2);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('handles document with missing metadata defaults', async () => {
    (pickDocuments as jest.Mock).mockResolvedValue([
      {uri: 'uri', name: null, type: null, size: null},
    ]);
    await triggerAttachmentOption(2);

    expect(mockSendFile).toHaveBeenCalledWith(
      'uri',
      'Document',
      'application/octet-stream',
    );
  });
});
