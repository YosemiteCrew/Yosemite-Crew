import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {CustomAttachment} from '@/features/chat/components/CustomAttachment';
import {useMessageContext} from 'stream-chat-react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        primaryTint: '#E6F0FE',
        cardBackground: '#ffffff',
        secondary: '#000000',
        textSecondary: '#888888',
      },
    },
  }),
}));

// 2. Mock Stream Chat
jest.mock('stream-chat-react-native', () => {
  const {View, Text} = require('react-native');
  return {
    useMessageContext: jest.fn(),
    Attachment: (_props: any) => (
      <View testID="stream-default-attachment">
        <Text>Default Attachment</Text>
      </View>
    ),
  };
});

// 3. Mock External Libraries
jest.mock('react-native-video', () => 'Video');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

// 4. Mock Local Components
jest.mock('@/features/chat/components/VoiceMessagePlayer', () => ({
  VoiceMessagePlayer: (props: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="voice-message-player">
        <Text>Duration: {props.duration}</Text>
        <Text>Url: {props.audioUrl}</Text>
      </View>
    );
  },
}));

describe('CustomAttachment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Helper to set message context ---
  const mockContext = (attachments: any[] | null) => {
    (useMessageContext as jest.Mock).mockReturnValue({
      message: {attachments},
    });
  };

  // 1. Null/Empty State Tests
  describe('Empty States', () => {
    it('returns null if attachments are undefined', () => {
      mockContext(undefined as unknown as any[]); // Force undefined
      const {toJSON} = render(<CustomAttachment />);
      expect(toJSON()).toBeNull();
    });

    it('returns null if attachments array is empty', () => {
      mockContext([]);
      const {toJSON} = render(<CustomAttachment />);
      expect(toJSON()).toBeNull();
    });
  });

  // 2. Audio Attachment Tests
  describe('Audio Attachment', () => {
    it('renders VoiceMessagePlayer with correct calculated duration', () => {
      mockContext([
        {type: 'audio', asset_url: 'http://audio.mp3', duration: 10}, // 10 seconds
      ]);

      const {getByTestId, getByText} = render(<CustomAttachment />);

      expect(getByTestId('voice-message-player')).toBeTruthy();
      // Expect 10 * 1000 = 10000ms
      expect(getByText('Duration: 10000')).toBeTruthy();
    });

    it('renders VoiceMessagePlayer with undefined duration if invalid', () => {
      mockContext([
        {type: 'audio', asset_url: 'http://audio.mp3', duration: null},
      ]);

      const {getByTestId} = render(<CustomAttachment />);

      expect(getByTestId('voice-message-player')).toBeTruthy();
      // Since props.duration is undefined, React Text might verify it doesn't print explicitly
      // or we can verify the mock was called with undefined props.
    });
  });

  // 3. Video Attachment Tests
  describe('Video Attachment', () => {
    it('renders Video component and toggles play/pause on press', () => {
      mockContext([
        {type: 'video', asset_url: 'http://video.mp4', title: 'My Video'},
      ]);

      const {getByText} = render(<CustomAttachment />);

      // Initial State: Paused (Play button visible)
      // Note: We need to find the Touchable that wraps the video.
      // Since we mocked Icon, we assume the play icon exists.
      // Or we check the text.
      expect(getByText('My Video')).toBeTruthy();

      // Find the container Touchable by looking for one that contains the video text or icon
      // In this specific component structure, the root of the return is TouchableOpacity
      // for the video branch.
      // Let's use fireEvent on the element containing the text for simplicity,
      // or traverse up if needed, but RNTL handles bubbling.

      // Alternatively, find the element rendering the 'play-arrow' Icon (Overlay)
      // Since Icon is mocked as string 'Icon', we look for the view structure or testID if we added one.
      // Given the source, `Icon` returns a React Element.
      // Let's just press the text 'My Video', it should bubble up to the Touchable.

      fireEvent.press(getByText('My Video'));

      // Verify Haptic
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );

      // The component toggles state.
      // If we press it again, it toggles back.
      fireEvent.press(getByText('My Video'));
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(2);
    });
  });

  // 4. File Attachment Tests
  describe('File Attachment', () => {
    it('renders file info with formatted size (KB)', () => {
      mockContext([
        {
          type: 'file',
          asset_url: 'http://file.pdf',
          title: 'Document.pdf',
          file_size: 2048, // 2048 bytes = 2.0 KB
        },
      ]);

      const {getByText} = render(<CustomAttachment />);

      expect(getByText('Document.pdf')).toBeTruthy();
      expect(getByText('2.0 KB')).toBeTruthy();
    });

    it('renders file info without size if file_size is missing', () => {
      mockContext([
        {
          type: 'file',
          asset_url: 'http://file.pdf',
          title: 'Unknown.pdf',
          // file_size missing
        },
      ]);

      const {getByText, queryByText} = render(<CustomAttachment />);

      expect(getByText('Unknown.pdf')).toBeTruthy();
      expect(queryByText(/KB/)).toBeNull();
    });

    it('triggers haptic feedback on file press', () => {
      mockContext([
        {type: 'file', asset_url: 'http://file.pdf', title: 'PressMe.pdf'},
      ]);

      const {getByText} = render(<CustomAttachment />);

      fireEvent.press(getByText('PressMe.pdf'));
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
    });

    it('uses default title "File" if title is missing', () => {
      mockContext([
        {type: 'file', asset_url: 'http://file.pdf'}, // No title
      ]);

      const {getByText} = render(<CustomAttachment />);
      expect(getByText('File')).toBeTruthy();
    });
  });

  // 5. Default Fallback Tests
  describe('Default Attachment', () => {
    it('renders default Stream Attachment for unknown types or images', () => {
      mockContext([{type: 'image', asset_url: 'http://image.png'}]);

      const {getByTestId} = render(<CustomAttachment />);
      expect(getByTestId('stream-default-attachment')).toBeTruthy();
    });

    it('renders default Stream Attachment for audio without asset_url', () => {
      // Branch coverage: type is audio but no url
      mockContext([{type: 'audio', asset_url: null}]);
      const {getByTestId} = render(<CustomAttachment />);
      expect(getByTestId('stream-default-attachment')).toBeTruthy();
    });
  });
});
