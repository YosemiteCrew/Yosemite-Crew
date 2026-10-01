'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { SpeechTranscriptionAdapter, SpeechTranscriptionEvents } from './speechTranscription';
import type { Announce } from './useAnnouncer';

export type VoiceCaptureState = 'idle' | 'listening' | 'processing' | 'correcting' | 'unsupported';

export const NO_SPEECH_MESSAGE =
  'No speech was heard. Record again, or type the message in the composer.';

const getMediaRecorderType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : undefined;
};

const joinTranscript = (previous: string, next: string): string =>
  previous && next ? `${previous} ${next}` : previous || next;

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
  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const finalTranscriptRef = useRef('');
  const finalizeGuardRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const recorderSettledRef = useRef(false);
  const engineStartedRef = useRef(false);
  const engineEndedRef = useRef(false);
  const engineLiveRef = useRef(false);
  const unmountedRef = useRef(false);
  const outerStateRef = useRef(state);

  useEffect(() => {
    outerStateRef.current = state;
  });

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
    chunksRef.current = [];
  }, []);

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
    onRecordingReady(chunksRef.current);
    releaseMicrophone();
    finalizeToCorrecting();
  }, [finalizeToCorrecting, onRecordingReady, releaseMicrophone]);

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
    transcriber.stop();
  }, [transcriber, announce, requestRecorderStop]);

  const buildTranscriptHandlers = useCallback(
    (): SpeechTranscriptionEvents => ({
      onStart: () => {
        engineStartedRef.current = true;
      },
      onInterim: (interim: string) => {
        if (outerStateRef.current === 'listening') {
          setText(joinTranscript(finalTranscriptRef.current, interim));
        }
      },
      onFinal: (finalText: string) => {
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
    }),
    [announce, finalizeToCorrecting, requestRecorderStop]
  );

  const openRecorder = useCallback(async (): Promise<boolean> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (unmountedRef.current) {
      // The panel went away while the browser was still asking for the
      // microphone. Release it rather than opening a recorder nobody can stop.
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    const recorder = new MediaRecorder(stream, { mimeType: getMediaRecorderType() });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => handleRecordingStopped();
    mediaRecorderRef.current = recorder;
    recorder.start(50);
    return true;
  }, [handleRecordingStopped]);

  const describeStartFailure = (error: unknown): string =>
    error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'Microphone access was denied. Check your browser permissions and try again.'
      : 'Voice capture failed. Type your message instead.';

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setText('');
    onReleaseAudio();
    resetSessionFlags();
    engineLiveRef.current = true;
    try {
      const opened = await openRecorder();
      if (!opened) return;
      setState('listening');
      outerStateRef.current = 'listening';
      announce('Recording started. Speak now.');
      transcriber.start(buildTranscriptHandlers());
    } catch (error) {
      console.error('Failed to start recording:', error);
      engineLiveRef.current = false;
      const message = describeStartFailure(error);
      setErrorMessage(message);
      announce(message);
      setState('idle');
    }
  }, [
    announce,
    buildTranscriptHandlers,
    onReleaseAudio,
    openRecorder,
    resetSessionFlags,
    transcriber,
  ]);

  const toggleRecording = useCallback(() => {
    if (outerStateRef.current === 'listening') {
      stopRecording();
      return;
    }
    void startRecording();
  }, [startRecording, stopRecording]);

  const discard = useCallback(() => {
    onReleaseAudio();
    releaseMicrophone();
    resetSessionFlags();
    setText('');
    setErrorMessage(null);
    setState('idle');
    announce('Voice capture cleared');
  }, [announce, onReleaseAudio, releaseMicrophone, resetSessionFlags]);

  const confirm = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const original = finalTranscriptRef.current;
    if (original && text !== original) {
      onCorrection?.(original, text);
    }
    onTranscript?.(trimmed);
    onReleaseAudio();
    resetSessionFlags();
    setText('');
    setErrorMessage(null);
    setState('idle');
    announce('Transcript confirmed');
  }, [announce, onCorrection, onReleaseAudio, onTranscript, resetSessionFlags, text]);

  const retry = useCallback(() => {
    void startRecording();
  }, [startRecording]);

  const handleTranscriptChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  }, []);

  const handleTranscriptKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        confirm();
      } else if (event.key === 'Escape') {
        discard();
      }
    },
    [confirm, discard]
  );

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      engineLiveRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      releaseMicrophone();
      transcriber.abort();
    };
  }, [releaseMicrophone, transcriber]);

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
    text,
    errorMessage,
    toggleRecording,
    retry,
    confirm,
    discard,
    handleTranscriptChange,
    handleTranscriptKeyDown,
  };
}
