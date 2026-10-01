'use client';

import { useId, useRef, useState } from 'react';
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
import { useAnnouncer } from './useAnnouncer';
import { useRecordingPlayback } from './useRecordingPlayback';
import { useVoiceRecordingSession, type VoiceCaptureState } from './useVoiceRecordingSession';

export type { VoiceCaptureState };

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

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const transcriptFieldId = useId();

  const { liveRegionRef, announce } = useAnnouncer();
  const { isPlaying, attachRecording, togglePlayback, stopPlayback, releaseAudio } =
    useRecordingPlayback(announce);
  const session = useVoiceRecordingSession({
    transcriber: activeTranscriber,
    announce,
    onRecordingReady: attachRecording,
    onReleaseAudio: releaseAudio,
    onStop,
    onTranscript,
    onCorrection,
  });
  const { state, text, errorMessage } = session;

  return (
    <div
      className={clsx(
        'relative flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-4',
        className
      )}
      role="region"
      aria-label="Voice capture"
    >
      <div ref={liveRegionRef} role="status" aria-atomic="true" className="sr-only" />

      <VoiceCaptureControls
        state={state}
        isPlaying={isPlaying}
        micButtonRef={micButtonRef}
        onToggleRecording={session.toggleRecording}
        onTogglePlayback={togglePlayback}
        onStopPlayback={stopPlayback}
        onDiscard={session.discard}
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
            onChange={session.handleTranscriptChange}
            onKeyDown={session.handleTranscriptKeyDown}
            placeholder={placeholder}
            rows={3}
            className="text-[13px]"
          />
        </div>
      )}

      <VoiceCaptureActions
        state={state}
        text={text}
        onRetry={session.retry}
        onConfirm={session.confirm}
      />
    </div>
  );
}

export default VoiceCapture;
