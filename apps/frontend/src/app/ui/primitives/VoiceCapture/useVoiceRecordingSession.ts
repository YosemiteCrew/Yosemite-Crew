'use client';

import {
  useCallback,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { SpeechTranscriptionAdapter } from './speechTranscription';
import type { Announce } from './useAnnouncer';
import { useMicrophoneCapture } from './useMicrophoneCapture';
import { useTranscriptReview } from './useTranscriptReview';
import { type VoiceCaptureState } from './voiceCaptureTypes';
import {
  useRecordingSessionActions,
  useRecordingSessionCleanup,
  useRecordingSessionFinalization,
  useRecordingSessionRefs,
} from './useVoiceRecordingSessionParts';

export type { VoiceCaptureState } from './voiceCaptureTypes';

export interface VoiceRecordingSession {
  state: VoiceCaptureState;
  text: string;
  errorMessage: string | null;
  toggleRecording: () => void;
  retry: () => void;
  confirm: () => void;
  discard: () => void;
  handleTranscriptChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleTranscriptKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
}

interface UseVoiceRecordingSessionOptions {
  transcriber: SpeechTranscriptionAdapter;
  announce: Announce;
  onRecordingReady: (chunks: Blob[]) => void;
  onReleaseAudio: () => void;
  onStop?: () => void;
  onTranscript?: (transcript: string) => void;
  onCorrection?: (original: string, corrected: string) => void;
}

export function useVoiceRecordingSession({
  transcriber,
  announce,
  onRecordingReady,
  onReleaseAudio,
  onStop,
  onTranscript,
  onCorrection,
}: UseVoiceRecordingSessionOptions): VoiceRecordingSession {
  const [state, setState] = useState<VoiceCaptureState>(() =>
    transcriber.isSupported() ? 'idle' : 'unsupported'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mic = useMicrophoneCapture();
  const refs = useRecordingSessionRefs(state);
  const returnToIdle = useCallback(() => {
    mic.releaseMicrophone();
    refs.resetTake();
    setErrorMessage(null);
    setState('idle');
  }, [mic, refs]);
  const review = useTranscriptReview({
    announce,
    spokenRef: refs.finalTranscript,
    onReleaseAudio,
    onReset: returnToIdle,
    onTranscript,
    onCorrection,
  });
  const finalization = useRecordingSessionFinalization({
    announce,
    mic,
    refs,
    review,
    setErrorMessage,
    setState,
    onRecordingReady,
    onStop,
    transcriber,
  });
  const actions = useRecordingSessionActions({
    announce,
    mic,
    refs,
    review,
    setErrorMessage,
    setState,
    transcriber,
    handleRecorderStopped: finalization.handleRecorderStopped,
    finalize: finalization.finalize,
    stopRecording: finalization.stopRecording,
    onReleaseAudio,
  });
  useRecordingSessionCleanup({
    mic,
    refs,
    transcriber,
    stopRecording: finalization.stopRecording,
  });

  return {
    state,
    text: review.text,
    errorMessage,
    ...actions,
    confirm: review.confirm,
    discard: review.clear,
    handleTranscriptChange: review.change,
    handleTranscriptKeyDown: review.handleKeyDown,
  };
}
