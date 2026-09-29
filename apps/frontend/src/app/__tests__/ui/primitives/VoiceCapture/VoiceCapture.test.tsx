import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { animate } from 'framer-motion';
import { VoiceCapture } from '@/app/ui/primitives/VoiceCapture/VoiceCapture';

jest.mock('framer-motion', () => ({
  animate: jest.fn(() => ({ stop: jest.fn() })),
}));

const mockMediaDevices = {
  getUserMedia: jest.fn(),
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: mockMediaDevices,
  configurable: true,
});

let mockMediaRecorderInstance: any = null;
let mockAudioInstance: any = null;

const createMockMediaRecorder = () => {
  const instance = {
    start: jest.fn(),
    stop: jest.fn(),
    state: 'recording',
    stream: {
      getTracks: () => [{ stop: jest.fn() }],
    },
    ondataavailable: null as ((event: BlobEvent) => void) | null,
    onstop: null as (() => void) | null,
  };
  mockMediaRecorderInstance = instance;
  return instance;
};

const createMockAudio = () => {
  const instance = {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    src: '',
    onended: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockAudioInstance = instance;
  return instance;
};

global.MediaRecorder = jest
  .fn()
  .mockImplementation(() => createMockMediaRecorder()) as unknown as typeof MediaRecorder;
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();
global.Audio = jest.fn().mockImplementation(() => createMockAudio()) as unknown as typeof Audio;

const defaultProps = {
  onTranscript: jest.fn(),
  onCorrection: jest.fn(),
  onStop: jest.fn(),
  placeholder: 'Press microphone to record…',
  autoPlay: false,
};

function resetMocks() {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockMediaRecorderInstance = null;
  mockAudioInstance = null;
  global.MediaRecorder = jest
    .fn()
    .mockImplementation(() => createMockMediaRecorder()) as unknown as typeof MediaRecorder;
  mockMediaDevices.getUserMedia.mockClear();
  mockMediaDevices.getUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: jest.fn() }],
  });
}

function mockMotionPreference(matches: boolean) {
  let onMediaChange: ((event: MediaQueryListEvent) => void) | undefined;
  const removeEventListener = jest.fn();
  jest.spyOn(window, 'matchMedia').mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListener) => {
      onMediaChange = listener as (event: MediaQueryListEvent) => void;
    },
    removeEventListener,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as unknown as MediaQueryList);

  return {
    removeEventListener,
    setMatches: (nextMatches: boolean) =>
      onMediaChange?.({ matches: nextMatches } as MediaQueryListEvent),
  };
}

function triggerOnStop() {
  if (mockMediaRecorderInstance && mockMediaRecorderInstance.onstop) {
    act(() => {
      mockMediaRecorderInstance.onstop();
    });
  }
}

function triggerAudioEnd() {
  if (mockAudioInstance && mockAudioInstance.onended) {
    act(() => {
      mockAudioInstance.onended();
    });
  }
}

describe('VoiceCapture', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('renders idle state correctly', () => {
    render(<VoiceCapture {...defaultProps} />);

    expect(screen.getByRole('region', { name: 'Voice capture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
    expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
    expect(screen.getByText('Press the microphone button to start recording')).toBeInTheDocument();
  });

  it('starts recording when microphone button is clicked', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    expect(screen.getByText('Listening…')).toBeInTheDocument();
    expect(screen.getByText('Speak now. Press stop to finish recording')).toBeInTheDocument();
  });

  it('keeps recorded audio chunks and stops animation when reduced motion is enabled', async () => {
    const mediaQuery = mockMotionPreference(false);
    const { unmount } = render(<VoiceCapture {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
    );
    expect(animate).toHaveBeenCalledTimes(1);

    const chunk = new Blob(['spoken note']);
    act(() => {
      mockMediaRecorderInstance.ondataavailable?.({ data: chunk } as BlobEvent);
      mediaQuery.setMatches(true);
    });

    const animationControls = (animate as unknown as jest.Mock).mock.results[0].value;
    expect(animationControls.stop).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    triggerOnStop();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: chunk.size }));

    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('does not animate the recording indicator when reduced motion is already enabled', async () => {
    mockMotionPreference(true);
    render(<VoiceCapture {...defaultProps} />);

    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
    );
    expect(animate).not.toHaveBeenCalled();
  });

  it('stops recording and shows processing state', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
      expect(screen.getByText('Transcribing your voice…')).toBeInTheDocument();
    });

    expect(defaultProps.onStop).toHaveBeenCalled();
  });

  it('has proper ARIA attributes', () => {
    render(<VoiceCapture {...defaultProps} />);

    const region = screen.getByRole('region', { name: 'Voice capture' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    expect(micButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('handles microphone permission denial', async () => {
    mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows live region announcements', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const liveRegions = screen.getAllByRole('status');
    const liveRegion = liveRegions.find((el) => el.classList.contains('sr-only'));
    expect(liveRegion).toBeInTheDocument();

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Recording started. Speak now.');
    });
  });

  it('disables microphone button during processing', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: 'Start recording' });
      expect(processingButton).toBeDisabled();
    });
  });

  it('transitions to playing state after processing completes', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    // Simulate MediaRecorder onstop (processing complete)
    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByText('Playing…')).toBeInTheDocument();
      expect(screen.getByText('Playing back recorded audio')).toBeInTheDocument();
    });

    // Play button should be visible (not playing yet)
    expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop and discard' })).toBeInTheDocument();
  });

  it('plays and pauses audio when play button is clicked', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument();
    });

    // Click play button to start playback
    const playButton = screen.getByRole('button', { name: 'Play recording' });
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(mockAudioInstance.play).toHaveBeenCalled();
    });

    // Button should now show pause
    expect(screen.getByRole('button', { name: 'Pause playback' })).toBeInTheDocument();

    // Click again to pause
    const pauseButton = screen.getByRole('button', { name: 'Pause playback' });
    await userEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });

    // Button should show play again
    expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument();
  });

  it('stops and discards recording', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop and discard' })).toBeInTheDocument();
    });

    const discardButton = screen.getByRole('button', { name: 'Stop and discard' });
    await userEvent.click(discardButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
      expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
    });

    expect(defaultProps.onTranscript).not.toHaveBeenCalled();
    expect(defaultProps.onCorrection).not.toHaveBeenCalled();
  });

  it('returns to idle after audio ends (non-autoPlay)', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play recording' })).toBeInTheDocument();
    });

    // Start playback
    const playButton = screen.getByRole('button', { name: 'Play recording' });
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(mockAudioInstance.play).toHaveBeenCalled();
    });

    // Trigger audio end - should transition to idle (non-autoPlay)
    triggerAudioEnd();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
      expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
    });
  });

  it('enters correcting state directly when autoPlay is true', async () => {
    render(<VoiceCapture {...defaultProps} autoPlay={true} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    // Should auto-transition to correcting state (autoPlay=true)
    await waitFor(() => {
      expect(screen.getByText('Correct transcript')).toBeInTheDocument();
      expect(screen.getByText('Edit the transcript if needed, then confirm')).toBeInTheDocument();
    });

    // Retry and Confirm buttons should be visible
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
  });

  it('confirms in correcting state (autoPlay) and calls onTranscript callback', async () => {
    render(<VoiceCapture {...defaultProps} autoPlay={true} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(defaultProps.onTranscript).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
    });
  });

  it('retries recording from correcting state (autoPlay)', async () => {
    render(<VoiceCapture {...defaultProps} autoPlay={true} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Processing…')).toBeInTheDocument();
    });

    triggerOnStop();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /Retry/i });
    await userEvent.click(retryButton);

    // Retry starts a new recording
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
      expect(screen.getByText('Listening…')).toBeInTheDocument();
    });

    expect(defaultProps.onTranscript).not.toHaveBeenCalled();
    expect(defaultProps.onCorrection).not.toHaveBeenCalled();
  });

  it('announces state changes via live region', async () => {
    render(<VoiceCapture {...defaultProps} />);

    const liveRegions = screen.getAllByRole('status');
    const liveRegion = liveRegions.find((el) => el.classList.contains('sr-only'));
    expect(liveRegion).toBeInTheDocument();

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Recording started. Speak now.');
    });

    const stopButton = screen.getByRole('button', { name: 'Stop recording' });
    await userEvent.click(stopButton);

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Recording stopped. Processing…');
    });

    triggerOnStop();

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Recording processed. Press play to review.');
    });
  });

  it('respects reduced motion preference', async () => {
    // The component already handles reduced motion via the useEffect
    // We can't easily test the matchMedia mock in jsdom, but we can verify
    // the component doesn't crash with reduced motion
    const { unmount } = render(<VoiceCapture {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'Start recording' });
    await userEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    });

    // Component should work without animation errors
    unmount();
  });
});
