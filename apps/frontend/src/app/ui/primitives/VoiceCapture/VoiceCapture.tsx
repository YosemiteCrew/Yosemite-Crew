'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  IoMicOutline,
  IoMicOffOutline,
  IoPlayOutline,
  IoPauseOutline,
  IoStopOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { Textarea } from '@/app/ui/Input';
import {
  WebSpeechTranscriptionAdapter,
  type SpeechTranscriptionAdapter,
} from './speechTranscription';

export type VoiceCaptureState = 'idle' | 'listening' | 'processing' | 'correcting' | 'unsupported';

export interface VoiceCaptureProps {
  onTranscript?: (transcript: string) => void;
  onCorrection?: (original: string, corrected: string) => void;
  onStop?: () => void;
  placeholder?: string;
  transcriber?: SpeechTranscriptionAdapter;
  className?: string;
}

const STATE_LABELS: Record<VoiceCaptureState, string> = {
  idle: 'Voice capture ready',
  listening: 'Listening',
  processing: 'Processing',
  correcting: 'Review transcript',
  unsupported: 'Voice capture unavailable',
};

const STATE_DESCRIPTIONS: Record<VoiceCaptureState, string> = {
  idle: 'Press the microphone button to start recording',
  listening: 'Speak now. Captions appear as you talk. Press stop to finish',
  processing: 'Finalizing transcript and audio',
  correcting: 'Edit the transcript if needed, review the audio, then confirm',
  unsupported: 'Voice capture is not available in this browser. Type instead.',
};

const NO_SPEECH_MESSAGE = 'No speech was heard. Record again, or type the message in the composer.';

const getMediaRecorderType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : undefined;
};

const joinTranscript = (previous: string, next: string): string =>
  previous && next ? `${previous} ${next}` : previous || next;

const getMicButtonLabel = (state: VoiceCaptureState): string => {
  if (state === 'idle') return 'Start voice recording';
  if (state === 'listening') return 'Stop recording';
  if (state === 'unsupported') return 'Voice capture unavailable';
  return 'Start a new voice recording';
};

const getMicButtonClassName = (state: VoiceCaptureState): string => {
  if (state === 'listening') {
    return 'bg-[var(--danger)] text-white ring-4 ring-[var(--danger-bg)]';
  }
  if (state === 'processing') {
    return 'bg-[var(--blue)] text-white cursor-wait';
  }
  if (state === 'unsupported') {
    return 'bg-[var(--screen-2)] text-[var(--ink-faint)] cursor-not-allowed';
  }
  return 'bg-[var(--screen-2)] text-[var(--ink-body)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue)]';
};

type VoiceCaptureControlsProps = {
  state: VoiceCaptureState;
  isPlaying: boolean;
  micButtonRef: React.RefObject<HTMLButtonElement | null>;
  onToggleRecording: () => void;
  onTogglePlayback: () => void;
  onStopPlayback: () => void;
  onDiscard: () => void;
};

const VoiceCaptureControls = ({
  state,
  isPlaying,
  micButtonRef,
  onToggleRecording,
  onTogglePlayback,
  onStopPlayback,
  onDiscard,
}: VoiceCaptureControlsProps) => {
  const micButtonClassName = clsx(
    'relative inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
    getMicButtonClassName(state)
  );

  const showPlaybackRow = state === 'correcting';

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={micButtonRef}
          type="button"
          aria-label={getMicButtonLabel(state)}
          aria-pressed={state === 'listening'}
          disabled={state === 'unsupported' || state === 'processing'}
          onClick={onToggleRecording}
          className={micButtonClassName}
        >
          {state === 'listening' ? (
            <IoMicOffOutline className="h-5 w-5" />
          ) : (
            <IoMicOutline className="h-5 w-5" />
          )}
          {state === 'listening' && (
            <span
              className="absolute inset-0 rounded-full bg-[var(--danger)] animate-ping motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <Text as="p" variant="body-3" className="truncate text-[var(--ink-body)]" role="status">
            {STATE_LABELS[state]}
          </Text>
          <Text as="p" variant="caption-1" className="truncate text-[var(--ink-soft)]">
            {STATE_DESCRIPTIONS[state]}
          </Text>
        </div>
      </div>

      {(showPlaybackRow || (state === 'idle' && isPlaying)) && (
        <div
          className="flex shrink-0 items-center gap-2"
          role="group"
          aria-label="Playback controls"
        >
          <button
            type="button"
            aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
            onClick={onTogglePlayback}
            disabled={!showPlaybackRow}
            className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-body)] transition-colors hover:bg-[var(--blue-soft)] hover:text-[var(--blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            {isPlaying ? (
              <IoPauseOutline className="h-5 w-5" />
            ) : (
              <IoPlayOutline className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Stop playback"
            onClick={onStopPlayback}
            className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-soft)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          >
            <IoStopOutline className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Discard recording"
            onClick={onDiscard}
            className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-soft)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          >
            <IoCloseOutline className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

const VoiceCaptureProgress = ({ state }: { state: VoiceCaptureState }) =>
  state === 'processing' && (
    <div className="relative overflow-hidden rounded-xl bg-[var(--screen-2)]" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hairline)]">
        <div className="yc-shimmer h-full w-1/3 bg-[var(--blue)]" />
      </div>
    </div>
  );

const VoiceCaptureCaptions = ({ state, text }: { state: VoiceCaptureState; text: string }) => {
  if (state !== 'listening') return null;
  return (
    <div
      className="min-h-10 rounded-xl bg-[var(--screen-2)] px-4 py-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Text as="p" variant="caption-1" className="text-[var(--ink-faint)]">
        Captions
      </Text>
      <Text as="p" variant="body-3" className="text-[var(--ink-body)]">
        {text || '…'}
      </Text>
    </div>
  );
};

type VoiceCaptureActionsProps = {
  state: VoiceCaptureState;
  text: string;
  onRetry: () => void;
  onConfirm: () => void;
};

const VoiceCaptureActions = ({ state, text, onRetry, onConfirm }: VoiceCaptureActionsProps) => {
  if (state !== 'correcting' && state !== 'unsupported') return null;
  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex items-center justify-end gap-2">
        {state === 'correcting' && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--screen)] px-3 py-1.5 font-satoshi text-caption-1 font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--screen-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoRefreshOutline className="h-4 w-4" />
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1.5 font-satoshi text-caption-1 font-medium text-white shadow-[0_2px_8px_var(--glow-b26)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
        >
          <IoCheckmarkOutline className="h-4 w-4" />
          Use text
        </button>
      </div>
    </div>
  );
};

export function VoiceCapture({
  onTranscript,
  onCorrection,
  onStop,
  placeholder = 'Press the microphone and speak, or type here…',
  transcriber,
  className,
}: VoiceCaptureProps) {
  const [fallbackTranscriber] = useState(() => new WebSpeechTranscriptionAdapter());
  const activeTranscriber = transcriber ?? fallbackTranscriber;

  const [state, setState] = useState<VoiceCaptureState>(() =>
    activeTranscriber.isSupported() ? 'idle' : 'unsupported'
  );
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const finalTranscriptRef = useRef('');
  const finalizeGuardRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const recorderSettledRef = useRef(false);
  const engineStartedRef = useRef(false);
  const engineEndedRef = useRef(false);
  const engineLiveRef = useRef(false);
  const unmountedRef = useRef(false);
  const transcriptFieldId = useId();

  const outerStateRef = useRef(state);
  useEffect(() => {
    outerStateRef.current = state;
  });

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = message;
      }, 50);
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audioElementRef.current = null;
    }
    audioChunksRef.current = [];
    setIsPlaying(false);
  }, []);

  const releaseMicrophone = useCallback(() => {
    const stream = mediaRecorderRef.current?.stream;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const resetSessionFlags = useCallback(() => {
    finalTranscriptRef.current = '';
    finalizeGuardRef.current = false;
    stopRequestedRef.current = false;
    recorderSettledRef.current = false;
    engineStartedRef.current = false;
    engineEndedRef.current = false;
    engineLiveRef.current = false;
  }, []);

  const resetToIdle = useCallback(() => {
    cleanupAudio();
    releaseMicrophone();
    resetSessionFlags();
    setText('');
    setErrorMessage(null);
    setState('idle');
    announce('Voice capture cleared');
  }, [cleanupAudio, releaseMicrophone, resetSessionFlags, announce]);

  const finalizeToCorrecting = useCallback(() => {
    if (unmountedRef.current || finalizeGuardRef.current) return;
    if (!recorderSettledRef.current) return;
    if (!engineEndedRef.current && engineStartedRef.current) return;
    finalizeGuardRef.current = true;
    const spoken = finalTranscriptRef.current;
    setText(spoken);
    setErrorMessage(spoken.trim() ? null : NO_SPEECH_MESSAGE);
    setState('correcting');
    announce('Recording complete. Review the transcript.');
    onStop?.();
  }, [announce, onStop]);

  const handleRecordingStopped = useCallback(() => {
    recorderSettledRef.current = true;
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioUrlRef.current = URL.createObjectURL(blob);
    const audio = new Audio(audioUrlRef.current);
    audioElementRef.current = audio;
    audio.onended = () => {
      if (!unmountedRef.current) setIsPlaying(false);
    };
    releaseMicrophone();
    finalizeToCorrecting();
  }, [finalizeToCorrecting, releaseMicrophone]);

  const requestRecorderStop = useCallback(() => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      handleRecordingStopped();
    }
  }, [handleRecordingStopped]);

  const stopRecording = useCallback(() => {
    finalizeGuardRef.current = false;
    setState('processing');
    announce('Recording stopped. Processing…');
    requestRecorderStop();
    activeTranscriber.stop();
  }, [activeTranscriber, announce, requestRecorderStop]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setText('');
    cleanupAudio();
    resetSessionFlags();
    engineLiveRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: getMediaRecorderType() });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        handleRecordingStopped();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(50);
      setState('listening');
      outerStateRef.current = 'listening';
      announce('Recording started. Speak now.');

      activeTranscriber.start({
        onStart: () => {
          engineStartedRef.current = true;
        },
        onInterim: (interim) => {
          if (outerStateRef.current === 'listening') {
            setText(joinTranscript(finalTranscriptRef.current, interim));
          }
        },
        onFinal: (finalText) => {
          if (!engineLiveRef.current) return;
          finalTranscriptRef.current = joinTranscript(finalTranscriptRef.current, finalText);
          if (outerStateRef.current === 'listening') {
            setText(finalTranscriptRef.current);
          }
        },
        onError: (error) => {
          if (outerStateRef.current === 'listening') {
            setErrorMessage(error.message);
            announce(error.message);
          }
        },
        onEnd: () => {
          engineLiveRef.current = false;
          engineEndedRef.current = true;
          if (outerStateRef.current === 'listening') {
            setState('processing');
            requestRecorderStop();
          }
          finalizeToCorrecting();
        },
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      engineLiveRef.current = false;
      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Check your browser permissions and try again.'
          : 'Voice capture failed. Type your message instead.';
      setErrorMessage(message);
      announce(message);
      setState('idle');
    }
  }, [
    activeTranscriber,
    announce,
    cleanupAudio,
    resetSessionFlags,
    requestRecorderStop,
    handleRecordingStopped,
    finalizeToCorrecting,
  ]);

  const handleToggleRecording = useCallback(() => {
    if (state === 'listening') {
      stopRecording();
      return;
    }
    startRecording();
  }, [state, startRecording, stopRecording]);

  const handleTogglePlayback = useCallback(() => {
    const audio = audioElementRef.current;
    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
      announce('Playback paused');
    } else {
      audio?.play().catch(() => {
        announce('Could not start playback');
      });
      setIsPlaying(true);
      announce('Playing recording');
    }
  }, [isPlaying, announce]);

  const handleStopPlayback = useCallback(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    announce('Playback stopped');
  }, [announce]);

  const handleTranscriptChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const original = finalTranscriptRef.current;
    if (original && text !== original) {
      onCorrection?.(original, text);
    }
    onTranscript?.(trimmed);
    cleanupAudio();
    resetSessionFlags();
    setText('');
    setErrorMessage(null);
    setState('idle');
    announce('Transcript confirmed');
  }, [text, onTranscript, onCorrection, cleanupAudio, resetSessionFlags, announce]);

  const handleRetry = useCallback(() => {
    cleanupAudio();
    resetSessionFlags();
    setText('');
    setErrorMessage(null);
    startRecording();
  }, [cleanupAudio, resetSessionFlags, startRecording]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        resetToIdle();
      }
    },
    [handleConfirm, resetToIdle]
  );

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      engineLiveRef.current = false;
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      releaseMicrophone();
      activeTranscriber.abort();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, [activeTranscriber, releaseMicrophone]);

  useEffect(() => {
    const listener = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        event.key === 'Escape' &&
        outerStateRef.current === 'listening'
      ) {
        stopRecording();
      }
    };
    globalThis.document.addEventListener('keydown', listener);
    return () => {
      globalThis.document.removeEventListener('keydown', listener);
    };
  }, [stopRecording]);

  return (
    <div
      className={clsx(
        'relative flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-4',
        className
      )}
      role="region"
      aria-label="Voice capture"
    >
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <VoiceCaptureControls
        state={state}
        isPlaying={isPlaying}
        micButtonRef={micButtonRef}
        onToggleRecording={handleToggleRecording}
        onTogglePlayback={handleTogglePlayback}
        onStopPlayback={handleStopPlayback}
        onDiscard={resetToIdle}
      />

      <VoiceCaptureProgress state={state} />
      <VoiceCaptureCaptions state={state} text={text} />

      {errorMessage && (
        <Text as="p" variant="caption-1" className="text-[var(--danger-text)]" role="alert">
          {errorMessage}
        </Text>
      )}

      {(state === 'correcting' || state === 'unsupported') && (
        <div className="flex flex-col gap-2">
          <label htmlFor={transcriptFieldId} className="text-caption-1 text-[var(--ink-soft)]">
            Transcript
          </label>
          <Textarea
            id={transcriptFieldId}
            value={text}
            onChange={handleTranscriptChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={3}
            className="text-[13px]"
          />
        </div>
      )}

      <VoiceCaptureActions
        state={state}
        text={text}
        onRetry={handleRetry}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

export default VoiceCapture;
