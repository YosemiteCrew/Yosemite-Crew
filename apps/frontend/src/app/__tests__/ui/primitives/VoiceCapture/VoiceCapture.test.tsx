import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceCapture } from '@/app/ui/primitives/VoiceCapture/VoiceCapture';
import type {
  SpeechTranscriptionAdapter,
  SpeechTranscriptionError,
  SpeechTranscriptionEvents,
} from '@/app/ui/primitives/VoiceCapture/speechTranscription';

class MockTranscriber implements SpeechTranscriptionAdapter {
  readonly id = 'mock';
  events: SpeechTranscriptionEvents = {};
  startCalls = 0;
  stopEndsSession = true;

  isSupported = () => true;
  start = (events: SpeechTranscriptionEvents) => {
    this.events = events;
    this.startCalls += 1;
    events.onStart?.();
  };
  stop = jest.fn(() => {
    if (this.stopEndsSession) this.events.onEnd?.();
  });
  abort = jest.fn();

  emitInterim(text: string) {
    this.events.onInterim?.(text);
  }
  emitFinal(text: string) {
    this.events.onFinal?.(text);
  }
  emitError(error: SpeechTranscriptionError) {
    this.events.onError?.(error);
  }
  emitEnd() {
    this.events.onEnd?.();
  }
}

type MockMediaRecorderInstance = {
  start: jest.Mock;
  stop: jest.Mock;
  state: string;
  stream: { getTracks: () => { stop: jest.Mock }[] };
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
};

type MockAudioInstance = {
  play: jest.Mock;
  pause: jest.Mock;
  currentTime: number;
  src: string;
  onended: (() => void) | null;
};

let mediaRecorderInstance: MockMediaRecorderInstance | null = null;
let audioInstance: MockAudioInstance | null = null;
let getUserMedia: jest.Mock;
let mockTrack: { stop: jest.Mock };

function createMediaRecorder() {
  const instance: MockMediaRecorderInstance = {
    start: jest.fn(),
    stop: jest.fn(),
    state: 'recording',
    stream: { getTracks: () => [mockTrack] },
    ondataavailable: null,
    onstop: null,
  };
  mediaRecorderInstance = instance;
  return instance;
}

function createAudio() {
  const instance: MockAudioInstance = {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    currentTime: 0,
    src: '',
    onended: null,
  };
  audioInstance = instance;
  return instance;
}

const makeSupportedTranscriber = () => new MockTranscriber();
const makeUnsupportedTranscriber = (): SpeechTranscriptionAdapter => ({
  id: 'mock-unsupported',
  isSupported: () => false,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
});

function setupMediaMocks() {
  mockTrack = { stop: jest.fn() };
  getUserMedia = jest.fn().mockResolvedValue({
    getTracks: () => [mockTrack],
  });
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
  global.MediaRecorder = jest
    .fn()
    .mockImplementation(createMediaRecorder) as unknown as typeof MediaRecorder;
  Object.assign(global.MediaRecorder, { isTypeSupported: jest.fn(() => true) });
  global.URL.createObjectURL = jest.fn(
    () => 'blob:mock-url'
  ) as unknown as typeof URL.createObjectURL;
  global.URL.revokeObjectURL = jest.fn() as unknown as typeof URL.revokeObjectURL;
  global.Audio = jest.fn().mockImplementation(createAudio) as unknown as typeof Audio;
}

async function startListening(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Start voice recording'));
  expect(await screen.findByLabelText('Stop recording')).toBeInTheDocument();
}

async function stopRecordingFor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Stop recording'));
  await act(async () => {
    mediaRecorderInstance?.onstop?.();
  });
}

async function emit(transcriber: MockTranscriber, fire: (t: MockTranscriber) => void) {
  await act(async () => {
    fire(transcriber);
  });
}

describe('VoiceCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMediaMocks();
  });

  it('shows the typed fallback and confirms from it when speech is unsupported', async () => {
    const user = userEvent.setup();
    const onTranscript = jest.fn();
    const onCorrection = jest.fn();
    render(
      <VoiceCapture
        transcriber={makeUnsupportedTranscriber()}
        onTranscript={onTranscript}
        onCorrection={onCorrection}
      />
    );

    expect(screen.getByText('Voice capture unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Voice capture unavailable')).toBeDisabled();

    await user.type(screen.getByLabelText('Transcript'), 'Restock antibiotics{enter}');

    expect(onTranscript).toHaveBeenCalledWith('Restock antibiotics');
    expect(onCorrection).not.toHaveBeenCalled();
  });

  it('starts listening on mic press, streams captions, and lands in the review state', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    const onStop = jest.fn();
    render(<VoiceCapture transcriber={transcriber} onStop={onStop} />);

    await startListening(user);

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(transcriber.startCalls).toBe(1);
    expect(screen.getByLabelText('Stop recording')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Listening')).toBeInTheDocument();

    await emit(transcriber, (t) => t.emitInterim('Hello'));
    expect(screen.getByText('Hello')).toBeInTheDocument();

    await emit(transcriber, (t) => t.emitFinal('Hello world'));
    await emit(transcriber, (t) => t.emitFinal('vaccine booster'));
    expect(screen.getByText('Hello world vaccine booster')).toBeInTheDocument();

    await emit(transcriber, (t) => t.emitInterim(''));
    expect(screen.getByText('Hello world vaccine booster')).toBeInTheDocument();

    await stopRecordingFor(user);

    expect(screen.getByText('Review transcript')).toBeInTheDocument();
    expect(onStop).toHaveBeenCalled();
  });

  it('calls onCorrection when the author edits a spoken transcript before confirming', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    const onTranscript = jest.fn();
    const onCorrection = jest.fn();
    render(
      <VoiceCapture
        transcriber={transcriber}
        onTranscript={onTranscript}
        onCorrection={onCorrection}
      />
    );

    await startListening(user);
    await act(async () => {
      mediaRecorderInstance?.ondataavailable?.({ data: { size: 0 } } as unknown as BlobEvent);
    });
    await act(async () => {
      mediaRecorderInstance?.ondataavailable?.({ data: { size: 42 } } as unknown as BlobEvent);
    });
    await emit(transcriber, (t) => t.emitFinal('Restock dentist'));
    await stopRecordingFor(user);

    const input = screen.getByLabelText('Transcript');
    await user.clear(input);
    await user.type(input, 'Restock dentastix');
    await user.click(screen.getByText('Use text'));

    expect(onCorrection).toHaveBeenCalledWith('Restock dentist', 'Restock dentastix');
    expect(onTranscript).toHaveBeenCalledWith('Restock dentastix');
  });

  it('skips onCorrection when the confirmed transcript is unchanged', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    const onTranscript = jest.fn();
    const onCorrection = jest.fn();
    render(
      <VoiceCapture
        transcriber={transcriber}
        onTranscript={onTranscript}
        onCorrection={onCorrection}
      />
    );

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('Book follow-up'));
    await stopRecordingFor(user);

    const input = screen.getByLabelText('Transcript');
    await user.clear(input);
    await user.keyboard('{Enter}');
    expect(onCorrection).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(screen.getByText('Review transcript')).toBeInTheDocument();

    await user.type(input, 'Book follow-up');
    await user.click(screen.getByText('Use text'));

    expect(onCorrection).not.toHaveBeenCalled();
    expect(onTranscript).toHaveBeenCalledWith('Book follow-up');
    expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
  });

  it('plays the recording, pauses, finishes on end, and stops playback on demand', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('comet progression'));
    await stopRecordingFor(user);

    await user.click(screen.getByLabelText('Play recording'));
    expect(audioInstance?.play).toHaveBeenCalled();
    expect(await screen.findByLabelText('Pause playback')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Pause playback'));
    expect(audioInstance?.pause).toHaveBeenCalled();
    expect(screen.getByLabelText('Play recording')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Play recording'));
    await act(async () => {
      audioInstance?.onended?.();
    });
    expect(screen.getByLabelText('Play recording')).toBeInTheDocument();
    expect(audioInstance?.pause).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Play recording'));
    await user.click(screen.getByLabelText('Stop playback'));
    expect(audioInstance?.pause).toHaveBeenCalledTimes(2);
    expect(audioInstance?.currentTime).toBe(0);
    expect(screen.getByLabelText('Play recording')).toBeInTheDocument();
  });

  it('announces when audio playback cannot start', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('blocked playback'));
    await stopRecordingFor(user);

    audioInstance!.play.mockRejectedValueOnce(new Error('blocked by autoplay policy'));
    await user.click(screen.getByLabelText('Play recording'));

    expect(await screen.findByText('Could not start playback')).toBeInTheDocument();
  });

  it('discards the recording and returns to idle', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('discard me'));
    await stopRecordingFor(user);

    await user.click(screen.getByLabelText('Discard recording'));

    expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByLabelText('Transcript')).not.toBeInTheDocument();
  });

  it('surfaces transcription errors during listening', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) =>
      t.emitError({
        code: 'network',
        message: 'Speech recognition needs a network connection. Try again when online.',
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/network connection/i);
  });

  it('finalizes into the review state when the engine ends on its own', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('auto ended'));
    await emit(transcriber, (t) => t.emitEnd());

    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(mediaRecorderInstance?.stop).toHaveBeenCalled();

    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });
    expect(screen.getByText('Review transcript')).toBeInTheDocument();

    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });
    expect(screen.getByText('Review transcript')).toBeInTheDocument();
  });

  it('stops listening on Escape and keeps partial progress', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('Escaped while listening'));
    await user.keyboard('{Escape}');

    expect(screen.getByText('Processing')).toBeInTheDocument();
    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });
    expect(screen.getByLabelText('Transcript')).toHaveValue('Escaped while listening');
  });

  it('resets from the review textarea on Escape', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('partial draft'));
    await stopRecordingFor(user);

    await user.click(screen.getByLabelText('Transcript'));
    await user.keyboard('{Escape}');

    expect(screen.getByText('Voice capture ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Transcript')).not.toBeInTheDocument();
  });

  it('shows the permission-denied message when microphone access is refused', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const transcriber = makeSupportedTranscriber();
      getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
      render(<VoiceCapture transcriber={transcriber} />);

      await user.click(screen.getByLabelText('Start voice recording'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
      expect(screen.getByLabelText('Start voice recording')).toBeEnabled();
      expect(transcriber.startCalls).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('falls back to idle with a message when MediaRecorder is unavailable', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      Object.assign(global, { MediaRecorder: undefined as unknown as typeof MediaRecorder });
      render(<VoiceCapture transcriber={makeSupportedTranscriber()} />);

      await user.click(screen.getByLabelText('Start voice recording'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Voice capture failed. Type your message instead.'
      );
      expect(screen.getByLabelText('Start voice recording')).toBeEnabled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('drops the mimeType hint when the browser lacks supported encoders', async () => {
    const user = userEvent.setup();
    Object.assign(global.MediaRecorder, { isTypeSupported: jest.fn(() => false) });
    render(<VoiceCapture transcriber={makeSupportedTranscriber()} />);

    await startListening(user);

    expect(global.MediaRecorder).toHaveBeenCalledWith(expect.any(Object), {
      mimeType: undefined,
    });
  });

  it('finalizes directly when the recorder was already inactive on manual stop', async () => {
    const user = userEvent.setup();
    render(<VoiceCapture transcriber={makeSupportedTranscriber()} />);

    await startListening(user);
    mediaRecorderInstance!.state = 'inactive';
    await user.click(screen.getByLabelText('Stop recording'));

    expect(mediaRecorderInstance?.stop).not.toHaveBeenCalled();
    expect(screen.getByText('Review transcript')).toBeInTheDocument();
  });

  it('finalizes directly when the engine ends and the recorder is already inactive', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    mediaRecorderInstance!.state = 'inactive';
    await emit(transcriber, (t) => t.emitEnd());

    expect(mediaRecorderInstance?.stop).not.toHaveBeenCalled();
    expect(screen.getByText('Review transcript')).toBeInTheDocument();
  });

  it('starts a new recording from the review state via Retry', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('redo this'));
    await stopRecordingFor(user);
    expect(screen.getByText('Review transcript')).toBeInTheDocument();

    await user.click(screen.getByText('Retry'));

    expect(await screen.findByText('Listening')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(transcriber.startCalls).toBe(2);
  });

  it('keeps the phrase the engine reports after the recorder has already stopped', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    transcriber.stopEndsSession = false;
    const onStop = jest.fn();
    render(<VoiceCapture transcriber={transcriber} onStop={onStop} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('book a follow up'));

    await user.click(screen.getByLabelText('Stop recording'));
    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });

    expect(onStop).not.toHaveBeenCalled();
    expect(screen.getByText('Processing')).toBeInTheDocument();

    await emit(transcriber, (t) => t.emitFinal('for Luna'));
    await emit(transcriber, (t) => t.emitEnd());

    expect(onStop).toHaveBeenCalled();
    expect(screen.getByText('Review transcript')).toBeInTheDocument();
    expect(screen.getByLabelText('Transcript')).toHaveValue('book a follow up for Luna');
  });

  it('opens the review box on the final transcript rather than the last interim caption', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    transcriber.stopEndsSession = false;
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('recheck stitches'));
    await emit(transcriber, (t) => t.emitInterim('recheck st'));

    await user.click(screen.getByLabelText('Stop recording'));
    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });
    await emit(transcriber, (t) => t.emitFinal('on Thursday'));
    await emit(transcriber, (t) => t.emitEnd());

    expect(screen.getByLabelText('Transcript')).toHaveValue('recheck stitches on Thursday');
  });

  it('releases the microphone only once the recorder has flushed its last chunk', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    transcriber.stopEndsSession = false;
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await user.click(screen.getByLabelText('Stop recording'));

    expect(mockTrack.stop).not.toHaveBeenCalled();

    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('explains that nothing was heard when the recording captures no speech', async () => {
    const user = userEvent.setup();
    render(<VoiceCapture transcriber={makeSupportedTranscriber()} />);

    await startListening(user);
    await stopRecordingFor(user);

    expect(screen.getByRole('alert')).toHaveTextContent('No speech was heard');
    expect(screen.getByLabelText('Transcript')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Use text' })).toBeDisabled();
  });

  it('does not offer an unusable transcript editor while idle', () => {
    render(<VoiceCapture transcriber={makeSupportedTranscriber()} />);

    expect(screen.queryByLabelText('Transcript')).not.toBeInTheDocument();
  });

  it('gives each mounted panel its own transcript field id', () => {
    render(
      <>
        <VoiceCapture transcriber={makeUnsupportedTranscriber()} />
        <VoiceCapture transcriber={makeUnsupportedTranscriber()} />
      </>
    );

    const fields = screen.getAllByLabelText('Transcript');
    expect(fields).toHaveLength(2);
    expect(fields[0].id).not.toBe(fields[1].id);
  });

  it('ignores a final phrase the engine reports after it has already ended', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitEnd());
    await emit(transcriber, (t) => t.emitFinal('phantom words'));
    await act(async () => {
      mediaRecorderInstance?.onstop?.();
    });

    expect(screen.getByLabelText('Transcript')).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent('No speech was heard');
  });

  it('releases the microphone instead of starting the engine when the panel unmounts mid-prompt', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    let grantMicrophone: (stream: { getTracks: () => { stop: jest.Mock }[] }) => void = () => {};
    getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          grantMicrophone = resolve as typeof grantMicrophone;
        })
    );
    const { unmount } = render(<VoiceCapture transcriber={transcriber} />);

    await user.click(screen.getByLabelText('Start voice recording'));
    unmount();
    await act(async () => {
      grantMicrophone({ getTracks: () => [mockTrack] });
    });

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(transcriber.startCalls).toBe(0);
  });

  it('cleans up the recorder, tracks, audio url, and transcriber on unmount', async () => {
    const user = userEvent.setup();
    const transcriber = makeSupportedTranscriber();
    const { unmount } = render(<VoiceCapture transcriber={transcriber} />);

    await startListening(user);
    await emit(transcriber, (t) => t.emitFinal('cleanup'));
    await stopRecordingFor(user);

    const trackStop = (mediaRecorderInstance?.stream.getTracks() as { stop: jest.Mock }[])[0].stop;

    unmount();

    expect(mediaRecorderInstance?.stop).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
    expect(transcriber.abort).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    act(() => {
      audioInstance?.onended?.();
    });
  });
});
