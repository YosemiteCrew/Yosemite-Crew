'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { SpeechTranscriptionAdapter } from './speechTranscription';
import { createTranscriptHandlers } from './transcriptEvents';
import type { Announce } from './useAnnouncer';
import { useMicrophoneCapture } from './useMicrophoneCapture';
import { useTranscriptReview } from './useTranscriptReview';
import { NO_SPEECH_MESSAGE, type VoiceCaptureState } from './voiceCaptureTypes';
import { logger } from '@/app/lib/logger';

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

/**
 * Coordinates the recorder and the speech engine. A take is only ready for
 * review once the recorder has flushed and the engine has reported its last
 * phrase, so the tail of the audio is never dropped.
 */
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

  const finalTranscriptRef = useRef('');
  const finalizeGuardRef = useRef(false);
  const recorderSettledRef = useRef(false);
  const engineStartedRef = useRef(false);
  const engineEndedRef = useRef(false);
  const engineLiveRef = useRef(false);
  const unmountedRef = useRef(false);
  const outerStateRef = useRef(state);

  useEffect(() => {
    outerStateRef.current = state;
  });

  const resetTake = useCallback(() => {
    finalTranscriptRef.current = '';
    finalizeGuardRef.current = false;
    recorderSettledRef.current = false;
    engineStartedRef.current = false;
    engineEndedRef.current = false;
    engineLiveRef.current = false;
  }, []);

  const returnToIdle = useCallback(() => {
    mic.releaseMicrophone();
    resetTake();
    setErrorMessage(null);
    setState('idle');
  }, [mic, resetTake]);

  const review = useTranscriptReview({
    announce,
    spokenRef: finalTranscriptRef,
    onReleaseAudio,
    onReset: returnToIdle,
    onTranscript,
    onCorrection,
  });

  const finalize = useCallback(() => {
    if (unmountedRef.current || finalizeGuardRef.current) return;
    if (!recorderSettledRef.current) return;
    if (!engineEndedRef.current && engineStartedRef.current) return;
    finalizeGuardRef.current = true;
    const spoken = finalTranscriptRef.current;
    review.setSpokenText(spoken);
    setErrorMessage(spoken.trim() ? null : NO_SPEECH_MESSAGE);
    setState('correcting');
    announce('Recording complete. Review the transcript.');
    onStop?.();
  }, [announce, onStop, review]);

  const handleRecorderStopped = useCallback(
    (chunks: Blob[]) => {
      recorderSettledRef.current = true;
      onRecordingReady(chunks);
      mic.releaseMicrophone();
      finalize();
    },
    [finalize, mic, onRecordingReady]
  );

  const stopRecording = useCallback(() => {
    finalizeGuardRef.current = false;
    setState('processing');
    announce('Recording stopped. Processing…');
    mic.requestStop();
    transcriber.stop();
  }, [announce, mic, transcriber]);

  const describeStartFailure = (error: unknown): string =>
    error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Microphone access was denied. Check your browser permissions and try again.'
      : 'Voice capture failed. Type your message instead.';

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    onReleaseAudio();
    resetTake();
    review.clearText();
    engineLiveRef.current = true;
    try {
      const opened = await mic.startCapture(handleRecorderStopped);
      if (!opened) return;
      setState('listening');
      outerStateRef.current = 'listening';
      announce('Recording started. Speak now.');
      transcriber.start(
        createTranscriptHandlers({
          phaseRef: outerStateRef,
          engineStartedRef,
          engineEndedRef,
          engineLiveRef,
          finalTranscriptRef,
          setText: review.setSpokenText,
          setPhase: setState,
          setErrorMessage,
          announce,
          requestStop: mic.requestStop,
          finalize,
        })
      );
    } catch (error) {
      logger.error('Failed to start recording:', error);
      engineLiveRef.current = false;
      const message = describeStartFailure(error);
      setErrorMessage(message);
      announce(message);
      setState('idle');
    }
  }, [
    announce,
    finalize,
    handleRecorderStopped,
    mic,
    onReleaseAudio,
    resetTake,
    review,
    transcriber,
  ]);

  const toggleRecording = useCallback(() => {
    if (outerStateRef.current === 'listening') {
      stopRecording();
      return;
    }
    void startRecording();
  }, [startRecording, stopRecording]);

  const retry = useCallback(() => {
    void startRecording();
  }, [startRecording]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      engineLiveRef.current = false;
      mic.stopRecorder();
      mic.releaseMicrophone();
      transcriber.abort();
    };
  }, [mic, transcriber]);

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

  return {
    state,
    text: review.text,
    errorMessage,
    toggleRecording,
    retry,
    confirm: review.confirm,
    discard: review.clear,
    handleTranscriptChange: review.change,
    handleTranscriptKeyDown: review.handleKeyDown,
  };
}
