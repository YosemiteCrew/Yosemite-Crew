'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { animate, type AnimationControls } from 'framer-motion';
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudioElement, setHasAudioElement] = useState(false);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const animationControlsRef = useRef<AnimationControls | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const prefersReducedMotion = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;
    // Set initial value without triggering effect warning
    if (mediaQuery.matches !== reducedMotion) {
      setTimeout(() => setReducedMotion(mediaQuery.matches), 0);
    }
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
      setReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [reducedMotion]);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
      setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = message;
      }, 50);
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioElementRef.current = null;
    }
    audioChunksRef.current = [];
    setHasAudioElement(false);
  }, [audioUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    const stream = mediaRecorder?.stream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, [mediaRecorder]);

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
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const audio = new Audio(url);
        audioElementRef.current = audio;
        setHasAudioElement(true);
        setState(autoPlay ? 'correcting' : 'playing');
        announce(
          autoPlay
            ? 'Recording processed. Ready to edit.'
            : 'Recording processed. Press play to review.'
        );
      };

      setMediaRecorder(recorder);
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
        { duration: 1, repeat: Infinity, easing: 'ease-in-out' }
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

  useEffect(() => {
    if (state === 'correcting') {
      setTimeout(() => {
        setCorrectedTranscript(transcript);
        transcriptRef.current?.focus();
      }, 0);
    }
  }, [state, transcript]);

  const micIcon =
    state === 'listening' ? (
      <IoMicOffOutline className="h-5 w-5" />
    ) : (
      <IoMicOutline className="h-5 w-5" />
    );
  const micLabel = state === 'listening' ? 'Stop recording' : 'Start recording';

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

  const playPauseAriaLabel = isPlaying ? 'Pause playback' : 'Play recording';

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

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            ref={micButtonRef}
            type="button"
            aria-label={micLabel}
            aria-pressed={state === 'listening'}
            onClick={toggleRecording}
            disabled={state === 'processing'}
            className={micButtonClassName}
          >
            {micIcon}
            {state === 'listening' && (
              <span
                ref={waveRef}
                className="absolute inset-0 rounded-full bg-[var(--danger)] opacity-30 animate-ping"
                aria-hidden="true"
              />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <Text as="p" variant="body-3" className="text-[var(--ink-body)] truncate" role="status">
              {STATE_LABELS[state]}
            </Text>
            <Text as="p" variant="caption-1" className="text-[var(--ink-soft)] truncate">
              {STATE_DESCRIPTIONS[state]}
            </Text>
          </div>
        </div>

        {(state === 'playing' || state === 'correcting') && hasAudioElement && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label={playPauseAriaLabel}
              onClick={handlePlayPause}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-body)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
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
              onClick={handleCancel}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--screen-2)] text-[var(--ink-soft)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
            >
              <IoStopOutline className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {(state === 'processing' || state === 'playing' || state === 'correcting') && (
        <div
          className="relative overflow-hidden rounded-xl bg-[var(--screen-2)] py-3 px-4"
          role="progressbar"
          aria-valuetext={STATE_LABELS[state]}
          aria-busy={state === 'processing'}
        >
          <div
            className={clsx(
              'h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden',
              state === 'processing' && 'animate-pulse'
            )}
          >
            {state === 'processing' && !reducedMotion && (
              <div
                className="h-full w-1/3 bg-gradient-to-r from-[var(--blue)] via-[var(--blue-strong)] to-[var(--blue)] animate-[shimmer_1.5s_infinite]"
                style={{
                  animation: 'shimmer 1.5s infinite',
                }}
              />
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
      )}

      {(state === 'playing' || state === 'correcting') && transcript && (
        <div className="flex flex-col gap-2">
          <Text
            as="label"
            variant="caption-1"
            className="text-[var(--ink-soft)]"
            htmlFor="voice-transcript"
          >
            Transcript
          </Text>
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

      {state === 'correcting' && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--screen)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-[var(--ink-body)] transition-colors hover:bg-[var(--screen-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoCloseOutline className="h-4 w-4" />
            Retry
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-white shadow-[0_2px_8px_var(--glow-b26)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoCheckmarkOutline className="h-4 w-4" />
            Confirm
          </button>
        </div>
      )}

      {state === 'idle' && transcript && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--blue)] px-3 py-1.5 font-satoshi text-[12px] font-medium text-white shadow-[0_2px_8px_var(--glow-b26)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoCheckmarkOutline className="h-4 w-4" />
            Use transcript
          </button>
        </div>
      )}
    </div>
  );
}

export default VoiceCapture;
