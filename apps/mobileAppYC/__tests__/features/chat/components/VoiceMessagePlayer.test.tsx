import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import VoiceMessagePlayer from '../../../../src/features/chat/components/VoiceMessagePlayer';
import Sound from 'react-native-nitro-sound';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// --- Mocks ---

// 1. Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        cardBackground: '#fff',
        primary: '#00f',
        textSecondary: '#888',
        error: '#f00',
        errorTint: '#fee',
      },
    },
  }),
}));

// 2. Mock Vector Icons
// Render the icon name as text so we can interact with it using getByText
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const {Text} = require('react-native');
  return ({name}: {name: string}) => <Text>{name}</Text>;
});

// 3. Mock Haptic Feedback
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

// 4. Mock Nitro Sound
let mockPlayBackListener: ((e: any) => void) | null = null;
let mockPlaybackEndListener: (() => void) | null = null;

jest.mock('react-native-nitro-sound', () => ({
  startPlayer: jest.fn(),
  pausePlayer: jest.fn(),
  resumePlayer: jest.fn(),
  stopPlayer: jest.fn(),
  addPlayBackListener: jest.fn(cb => {
    mockPlayBackListener = cb;
  }),
  addPlaybackEndListener: jest.fn(cb => {
    mockPlaybackEndListener = cb;
  }),
  removePlayBackListener: jest.fn(),
  removePlaybackEndListener: jest.fn(),
}));

describe('VoiceMessagePlayer', () => {
  const TEST_AUDIO_URL = 'http://example.com/audio.mp3';
  const TEST_DURATION = 60000; // 60 seconds

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayBackListener = null;
    mockPlaybackEndListener = null;
    // Default mocks to resolve successfully
    (Sound.startPlayer as jest.Mock).mockResolvedValue(undefined);
    (Sound.pausePlayer as jest.Mock).mockResolvedValue(undefined);
    (Sound.resumePlayer as jest.Mock).mockResolvedValue(undefined);
    (Sound.stopPlayer as jest.Mock).mockResolvedValue(undefined);
  });

  // --- 1. Rendering ---
  it('renders correctly in initial state', () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // Initial time should be 0:00 / 1:00
    expect(getByText('0:00 / 1:00')).toBeTruthy();
    // Play icon should be visible
    expect(getByText('play-arrow')).toBeTruthy();
  });

  it('handles zero or missing duration gracefully', () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} />,
    );
    // Should default to 0 duration
    expect(getByText('0:00 / 0:00')).toBeTruthy();
  });

  // --- 2. Playback Control (Play/Pause/Resume) ---

  it('starts playing from beginning when play button is pressed (first time)', async () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // Trigger Play
    fireEvent.press(getByText('play-arrow'));

    await waitFor(() => {
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
      expect(Sound.startPlayer).toHaveBeenCalledWith(TEST_AUDIO_URL);
      expect(Sound.addPlayBackListener).toHaveBeenCalled();
      expect(Sound.addPlaybackEndListener).toHaveBeenCalled();
    });
  });

  it('pauses playing when button is pressed while playing', async () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // 1. Start Play
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.startPlayer).toHaveBeenCalled());

    // 2. Pause (Icon changes to 'pause' when playing)
    fireEvent.press(getByText('pause'));
    await waitFor(() => expect(Sound.pausePlayer).toHaveBeenCalled());
  });

  it('resumes playing when button is pressed while paused (and position > 0)', async () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // 1. Start Play
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.startPlayer).toHaveBeenCalled());

    // 2. Simulate progress update so currentPosition > 0
    if (mockPlayBackListener) {
      mockPlayBackListener({currentPosition: 5000, duration: 60000});
    }

    // 3. Pause
    fireEvent.press(getByText('pause'));
    await waitFor(() => expect(Sound.pausePlayer).toHaveBeenCalled());

    // 4. Resume (Icon returns to 'play-arrow')
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.resumePlayer).toHaveBeenCalled());
  });

  // --- 3. Stop Control & Lifecycle ---

  it('stops playback and resets when stop button is pressed', async () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // Start playing to reveal Stop button
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.startPlayer).toHaveBeenCalled());

    // Stop button uses the 'stop' icon
    fireEvent.press(getByText('stop'));

    await waitFor(() => {
      expect(Sound.stopPlayer).toHaveBeenCalled();
      expect(Sound.removePlayBackListener).toHaveBeenCalled();
      expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
        'impactLight',
      );
    });
  });

  it('handles playback completion (end listener)', async () => {
    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    fireEvent.press(getByText('play-arrow'));
    await waitFor(() =>
      expect(Sound.addPlaybackEndListener).toHaveBeenCalled(),
    );

    // Simulate End
    if (mockPlaybackEndListener) {
      mockPlaybackEndListener();
    }

    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(
      'notificationSuccess',
    );
    // Should reset time
    expect(getByText('0:00 / 1:00')).toBeTruthy();
  });

  it('cleans up resources on unmount if playing', async () => {
    const {getByText, unmount} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} duration={TEST_DURATION} />,
    );

    // Start playing
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.startPlayer).toHaveBeenCalled());

    // Unmount while playing
    unmount();

    expect(Sound.stopPlayer).toHaveBeenCalled();
    expect(Sound.removePlayBackListener).toHaveBeenCalled();
  });

  // --- 4. Error Handling ---

  it('catches and logs errors during play start', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    (Sound.startPlayer as jest.Mock).mockRejectedValue(new Error('Play Error'));

    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} />,
    );

    fireEvent.press(getByText('play-arrow'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Audio playback error:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('catches and logs errors during stop', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Note: Use mockRejectedValueOnce for the FIRST call (explicit user stop).
    // Use mockResolvedValue for subsequent calls (useEffect cleanup).
    // The component's useEffect calls stopPlayer() when isPlaying flips to false,
    // and since that useEffect call is not caught, it would crash the test if we simply used mockRejectedValue.
    (Sound.stopPlayer as jest.Mock)
      .mockRejectedValueOnce(new Error('Stop Error'))
      .mockResolvedValue(undefined);

    const {getByText} = render(
      <VoiceMessagePlayer audioUrl={TEST_AUDIO_URL} />,
    );

    // Start
    fireEvent.press(getByText('play-arrow'));
    await waitFor(() => expect(Sound.startPlayer).toHaveBeenCalled());

    // Stop
    fireEvent.press(getByText('stop'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Audio stop error:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });
});
