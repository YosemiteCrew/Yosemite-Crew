'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { SpeechTranscriptionAdapter } from './speechTranscription';
import { createTranscriptHandlers } from './transcriptEvents';
import type { MicrophoneCapture } from './useMicrophoneCapture';
import type { TranscriptReview } from './useTranscriptReview';
import { NO_SPEECH_MESSAGE, type VoiceCaptureState } from './voiceCaptureTypes';
import type { Announce } from './useAnnouncer';
import { logger } from '@/app/lib/logger';

export interface RecordingSessionRefs {
  finalTranscript: MutableRefObject<string>;
  finalizeGuard: MutableRefObject<boolean>;
  recorderSettled: MutableRefObject<boolean>;
  engineStarted: MutableRefObject<boolean>;
  engineEnded: MutableRefObject<boolean>;
  engineLive: MutableRefObject<boolean>;
  unmounted: MutableRefObject<boolean>;
  outerState: MutableRefObject<VoiceCaptureState>;
  resetTake: () => void;
}

export function useRecordingSessionRefs(state: VoiceCaptureState): RecordingSessionRefs {
  const finalTranscript = useRef('');
  const finalizeGuard = useRef(false);
  const recorderSettled = useRef(false);
  const engineStarted = useRef(false);
  const engineEnded = useRef(false);
  const engineLive = useRef(false);
  const unmounted = useRef(false);
  const outerState = useRef(state);

  useEffect(() => {
    outerState.current = state;
  });

  const resetTake = useCallback(() => {
    finalTranscript.current = '';
    finalizeGuard.current = false;
    recorderSettled.current = false;
    engineStarted.current = false;
    engineEnded.current = false;
    engineLive.current = false;
  }, []);

  return useMemo(
    () => ({
      finalTranscript,
      finalizeGuard,
      recorderSettled,
      engineStarted,
      engineEnded,
      engineLive,
      unmounted,
      outerState,
      resetTake,
    }),
    [resetTake]
  );
}

interface RecordingSessionFinalizationOptions {
  announce: Announce;
  mic: MicrophoneCapture;
  refs: RecordingSessionRefs;
  review: TranscriptReview;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setState: Dispatch<SetStateAction<VoiceCaptureState>>;
  onRecordingReady: (chunks: Blob[]) => void;
  onStop?: () => void;
  transcriber: SpeechTranscriptionAdapter;
}

export function useRecordingSessionFinalization({
  announce,
  mic,
  refs,
  review,
  setErrorMessage,
  setState,
  onRecordingReady,
  onStop,
  transcriber,
}: RecordingSessionFinalizationOptions) {
  const {
    unmounted: unmountedRef,
    finalizeGuard: finalizeGuardRef,
    recorderSettled: recorderSettledRef,
    engineEnded: engineEndedRef,
    engineStarted: engineStartedRef,
    finalTranscript: finalTranscriptRef,
  } = refs;

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
  }, [
    announce,
    engineEndedRef,
    engineStartedRef,
    finalizeGuardRef,
    finalTranscriptRef,
    onStop,
    recorderSettledRef,
    review,
    setErrorMessage,
    setState,
    unmountedRef,
  ]);

  const handleRecorderStopped = useCallback(
    (chunks: Blob[]) => {
      recorderSettledRef.current = true;
      onRecordingReady(chunks);
      mic.releaseMicrophone();
      finalize();
    },
    [finalize, mic, onRecordingReady, recorderSettledRef]
  );

  const stopRecording = useCallback(() => {
    finalizeGuardRef.current = false;
    setState('processing');
    announce('Recording stopped. Processing…');
    mic.requestStop();
    transcriber.stop();
  }, [announce, finalizeGuardRef, mic, setState, transcriber]);

  return useMemo(
    () => ({ finalize, handleRecorderStopped, stopRecording }),
    [finalize, handleRecorderStopped, stopRecording]
  );
}

const describeStartFailure = (error: unknown): string =>
  error instanceof DOMException && error.name === 'NotAllowedError'
    ? 'Microphone access was denied. Check your browser permissions and try again.'
    : 'Voice capture failed. Type your message instead.';

interface RecordingSessionActionsOptions {
  announce: Announce;
  mic: MicrophoneCapture;
  refs: RecordingSessionRefs;
  review: TranscriptReview;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setState: Dispatch<SetStateAction<VoiceCaptureState>>;
  transcriber: SpeechTranscriptionAdapter;
  handleRecorderStopped: (chunks: Blob[]) => void;
  finalize: () => void;
  stopRecording: () => void;
  onReleaseAudio: () => void;
}

export function useRecordingSessionActions({
  announce,
  mic,
  refs,
  review,
  setErrorMessage,
  setState,
  transcriber,
  handleRecorderStopped,
  finalize,
  stopRecording,
  onReleaseAudio,
}: RecordingSessionActionsOptions) {
  const {
    resetTake,
    engineLive: engineLiveRef,
    outerState: outerStateRef,
    engineStarted: engineStartedRef,
    engineEnded: engineEndedRef,
    finalTranscript: finalTranscriptRef,
  } = refs;

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
    engineEndedRef,
    engineLiveRef,
    engineStartedRef,
    finalTranscriptRef,
    outerStateRef,
    review,
    resetTake,
    setErrorMessage,
    setState,
    transcriber,
  ]);

  const toggleRecording = useCallback(() => {
    if (outerStateRef.current === 'listening') {
      stopRecording();
      return;
    }
    void startRecording();
  }, [outerStateRef, startRecording, stopRecording]);

  return { toggleRecording, retry: startRecording };
}

interface RecordingSessionCleanupOptions {
  mic: MicrophoneCapture;
  refs: RecordingSessionRefs;
  transcriber: SpeechTranscriptionAdapter;
  stopRecording: () => void;
}

export function useRecordingSessionCleanup({
  mic,
  refs,
  transcriber,
  stopRecording,
}: RecordingSessionCleanupOptions) {
  const { unmounted: unmountedRef, engineLive: engineLiveRef, outerState: outerStateRef } = refs;

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      engineLiveRef.current = false;
      mic.stopRecorder();
      mic.releaseMicrophone();
      transcriber.abort();
    };
  }, [engineLiveRef, mic, transcriber, unmountedRef]);

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
  }, [outerStateRef, stopRecording]);
}
