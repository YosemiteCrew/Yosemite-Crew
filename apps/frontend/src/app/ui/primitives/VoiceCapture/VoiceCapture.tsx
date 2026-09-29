'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import {
  IoMicOutline,
  IoMicOffOutline,
  IoStopOutline,
  IoPlayOutline,
  IoPauseOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
} from 'react-icons/io5';
import { clsx } from 'clsx';
import Text from '@/app/ui/Text';
import { Textarea } from '@/app/ui/Input';

export type VoiceCaptureState = 'idle' | 'listening' | 'processing' | 'playing' | 'correcting';

export interface VoiceCaptureProps {
  onTranscript?: (transcript: string) => void;
  onCorrection?: (original: string, corrected: string) => void;
  onStop?: () => void;
  placeholder?: string;
  autoPlay?: boolean;
  className?: string;
}

const STATE_LABELS: Record<VoiceCaptureState, string> = {
  idle: 'Voice capture ready',
  listening: 'Listening…',
  processing: 'Processing…',
  playing: 'Playing…',
  correcting: 'Correct transcript',
};

const STATE_DESCRIPTIONS: Record<VoiceCaptureState, string> = {
  idle: 'Press the microphone button to start recording',
  listening: 'Speak now. Press stop to finish recording',
  processing: 'Transcribing your voice…',
  playing: 'Playing back recorded audio',
  correcting: 'Edit the transcript if needed, then confirm',
};

type VoiceCaptureControlsProps = {
  state: VoiceCaptureState;
  isPlaying: boolean;
  hasAudioElement: boolean;
  micButtonRef: React.RefObject<HTMLButtonElement | null>;
  waveRef: React.RefObject<HTMLDivElement | null>;
  onToggleRecording: () => void;
  onPlayPause: () => void;
  onDiscard: () => void;
};

const VoiceCaptureControls = ({
  state,
  isPlaying,
  hasAudioElement,
  micButtonRef,
  waveRef,
  onToggleRecording,
  onPlayPause,
  onDiscard,
}: VoiceCaptureControlsProps) => {
  const micButtonStateClassName = (() => {
    if (state === 'listening') {
      return 'bg-[var(--danger)] text-white shadow-[0_0_0_4px_var(--danger-soft)] animate-pulse';
    }
    if (state === 'processing') {
      return 'bg-[var(--blue)] text-white cursor-wait';
    }
    return 'bg-[var(--screen-2)] text-[var(--ink-body)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue)]';
  })();
  const micButtonClassName = clsx(
    'relative inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-all duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
    micButtonStateClassName
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={micButtonRef}
          type="button"
          aria-label={state === 'listening' ? 'Stop recording' : 'Start recording'}
          aria-pressed={state === 'listening'}
          onClick={onToggleRecording}
          disabled={state === 'processing'}
          className={micButtonClassName}
        >
          {state === 'listening' ? (
            <IoMicOffOutline className="h-5 w-5" />
          ) : (
            <IoMicOutline className="h-5 w-5" />
          )}
          {state === 'listening' && (
            <span
              ref={waveRef}
              className="absolute inset-0 rounded-full bg-[var(--danger)] opacity-30 animate-ping"
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

      {(state === 'playing' || state === 'correcting') && hasAudioElement && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
            onClick={onPlayPause}
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
            aria-label="Stop and discard"
            onClick={onDiscard}
            className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-soft)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          >
            <IoStopOutline className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

const VoiceCaptureProgress = ({
  state,
  reducedMotion,
}: {
  state: VoiceCaptureState;
  reducedMotion: boolean;
}) =>
  (state === 'processing' || state === 'playing' || state === 'correcting') && (
    <div
      className="relative overflow-hidden rounded-xl bg-[var(--screen-2)] px-4 py-3"
      role="progressbar"
      aria-valuetext={STATE_LABELS[state]}
      aria-busy={state === 'processing'}
    >
      <div
        className={clsx(
          'h-1.5 overflow-hidden rounded-full bg-[var(--hairline)]',
          state === 'processing' && 'animate-pulse'
        )}
      >
        {state === 'processing' && !reducedMotion && (
          <div className="h-full w-1/3 bg-gradient-to-r from-[var(--blue)] via-[var(--blue-strong)] to-[var(--blue)] animate-[shimmer_1.5s_infinite]" />
        )}
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );

type VoiceCaptureActionsProps = {
  state: VoiceCaptureState;
  transcript: string;
  onRetry: () => void;
  onConfirm: () => void;
};

const VoiceCaptureActions = ({
  state,
  transcript,
  onRetry,
  onConfirm,
}: VoiceCaptureActionsProps) => {
  if (state === 'correcting') {
    return (
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--screen)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--screen-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
        >
          <IoCloseOutline className="h-4 w-4" />
          Retry
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-white shadow-[0_2px_8px_var(--glow-b26)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
        >
          <IoCheckmarkOutline className="h-4 w-4" />
          Confirm
        </button>
      </div>
    );
  }

  return state === 'idle' && transcript ? (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onConfirm}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-white shadow-[0_2px_8px_var(--glow-b26)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
      >
        <IoCheckmarkOutline className="h-4 w-4" />
        Use transcript
      </button>
    </div>
  ) : null;
};

export function VoiceCapture({
  onTranscript,
  onCorrection,
  onStop,
  placeholder = 'Press microphone to record…',
  autoPlay = false,
  className,
}: VoiceCaptureProps) {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const [transcript, setTranscript] = useState('');
  const [correctedTranscript, setCorrectedTranscript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudioElement, setHasAudioElement] = useState(false);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const animationControlsRef = useRef<AnimationPlaybackControls | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Set initial value without triggering effect warning
    const initialPreferenceTimer = window.setTimeout(() => {
      setReducedMotion(mediaQuery.matches);
    }, 0);
    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => {
      window.clearTimeout(initialPreferenceTimer);
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
      setTimeout(() => {
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
      audio.src = '';
      audioElementRef.current = null;
    }
    audioChunksRef.current = [];
    setHasAudioElement(false);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    const stream = recorder?.stream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const handleStop = useCallback(() => {
    stopRecording();
    setState('processing');
    announce('Recording stopped. Processing…');
    onStop?.();
  }, [stopRecording, announce, onStop]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        audioUrlRef.current = URL.createObjectURL(blob);
        const audio = new Audio(audioUrlRef.current);
        audioElementRef.current = audio;
        setHasAudioElement(true);
        setState(autoPlay ? 'correcting' : 'playing');
        announce(
          autoPlay
            ? 'Recording processed. Ready to edit.'
            : 'Recording processed. Press play to review.'
        );
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setState('listening');
      announce('Recording started. Speak now.');
    } catch (error) {
      console.error('Failed to start recording:', error);
      announce('Failed to start recording. Please check microphone permissions.');
      setState('idle');
    }
  }, [announce, autoPlay]);

  const toggleRecording = useCallback(() => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'listening') {
      handleStop();
    }
  }, [state, startRecording, handleStop]);

  const handleAudioEnd = useCallback(() => {
    setIsPlaying(false);
    if (state === 'playing') {
      setState(autoPlay ? 'correcting' : 'idle');
    }
  }, [state, autoPlay]);

  const handlePlayPause = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      announce('Playback paused');
    } else {
      audio.play().catch(console.error);
      setIsPlaying(true);
      announce('Playing recording');
    }
  }, [isPlaying, announce]);

  const handleConfirm = useCallback(() => {
    const finalTranscript = correctedTranscript || transcript;
    onTranscript?.(finalTranscript);
    if (correctedTranscript && correctedTranscript !== transcript) {
      onCorrection?.(transcript, correctedTranscript);
    }
    cleanupAudio();
    setTranscript('');
    setCorrectedTranscript('');
    setState('idle');
    announce('Transcript confirmed');
  }, [transcript, correctedTranscript, onTranscript, onCorrection, cleanupAudio, announce]);

  const handleCancel = useCallback(() => {
    cleanupAudio();
    setTranscript('');
    setCorrectedTranscript('');
    setState('idle');
    announce('Recording cancelled');
  }, [cleanupAudio, announce]);

  const handleRetry = useCallback(() => {
    cleanupAudio();
    setTranscript('');
    setCorrectedTranscript('');
    startRecording();
  }, [cleanupAudio, startRecording]);

  const handleTranscriptChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setCorrectedTranscript(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  useEffect(() => {
    if (state === 'listening' && waveRef.current && !reducedMotion) {
      animationControlsRef.current = animate(
        waveRef.current,
        { scale: [1, 1.2, 1], opacity: [1, 0.6, 1] },
        { duration: 1, repeat: Infinity, ease: 'easeInOut' }
      );
    } else if (animationControlsRef.current) {
      animationControlsRef.current.stop();
      animationControlsRef.current = null;
    }
    return () => {
      if (animationControlsRef.current) {
        animationControlsRef.current.stop();
      }
    };
  }, [state, reducedMotion]);

  useEffect(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.onended = handleAudioEnd;
      return () => {
        audio.onended = null;
      };
    }
  }, [handleAudioEnd]);

  return (
    <div
      className={clsx(
        'relative flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-4',
        'transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
        className
      )}
      role="region"
      aria-label="Voice capture"
      aria-live="polite"
      aria-atomic="true"
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
        hasAudioElement={hasAudioElement}
        micButtonRef={micButtonRef}
        waveRef={waveRef}
        onToggleRecording={toggleRecording}
        onPlayPause={handlePlayPause}
        onDiscard={handleCancel}
      />

      <VoiceCaptureProgress state={state} reducedMotion={reducedMotion} />

      {(state === 'playing' || state === 'correcting') && transcript && (
        <div className="flex flex-col gap-2">
          <label htmlFor="voice-transcript" className="text-caption-1 text-[var(--ink-soft)]">
            Transcript
          </label>
          <Textarea
            ref={transcriptRef}
            id="voice-transcript"
            value={correctedTranscript || transcript}
            onChange={handleTranscriptChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={state !== 'correcting'}
            rows={3}
            className={clsx(
              'w-full rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-3 py-2.5 font-satoshi text-[13px] leading-6 text-[var(--ink-body)] outline-none placeholder:text-[var(--ink-faint)] transition-colors',
              'focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
              state !== 'correcting' && 'opacity-60 cursor-not-allowed'
            )}
            aria-label="Voice transcript"
            aria-describedby="transcript-hint"
          />
          <Text as="p" id="transcript-hint" variant="caption-1" className="text-[var(--ink-faint)]">
            {state === 'correcting'
              ? 'Edit if needed. Press Enter to confirm, Escape to cancel.'
              : 'Playback the recording to review the transcript.'}
          </Text>
        </div>
      )}

      <VoiceCaptureActions
        state={state}
        transcript={transcript}
        onRetry={handleRetry}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

export default VoiceCapture;
