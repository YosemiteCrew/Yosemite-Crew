'use client';

import type { RefObject } from 'react';
import type { SpeechTranscriptionEvents } from './speechTranscription';
import type { Announce } from './useAnnouncer';
import type { VoiceCaptureState } from './voiceCaptureTypes';

const joinTranscript = (previous: string, next: string): string =>
  previous && next ? `${previous} ${next}` : previous || next;

export interface TranscriptEventSources {
  phaseRef: RefObject<VoiceCaptureState>;
  engineStartedRef: RefObject<boolean>;
  engineEndedRef: RefObject<boolean>;
  engineLiveRef: RefObject<boolean>;
  finalTranscriptRef: RefObject<string>;
  setText: (value: string) => void;
  setPhase: (phase: VoiceCaptureState) => void;
  setErrorMessage: (message: string | null) => void;
  announce: Announce;
  requestStop: () => void;
  finalize: () => void;
}

/**
 * Maps speech-engine callbacks onto the session. Interim captions only follow
 * live speech, and a final phrase that lands after the engine has already
 * ended is ignored rather than allowed to replace what the user is reading.
 */
export function createTranscriptHandlers(
  sources: TranscriptEventSources
): SpeechTranscriptionEvents {
  const listening = () => sources.phaseRef.current === 'listening';

  return {
    onStart: () => {
      sources.engineStartedRef.current = true;
    },
    onInterim: (interim: string) => {
      if (listening()) {
        sources.setText(joinTranscript(sources.finalTranscriptRef.current, interim));
      }
    },
    onFinal: (finalText: string) => {
      if (!sources.engineLiveRef.current) return;
      sources.finalTranscriptRef.current = joinTranscript(
        sources.finalTranscriptRef.current,
        finalText
      );
      if (listening()) {
        sources.setText(sources.finalTranscriptRef.current);
      }
    },
    onError: (error) => {
      if (listening()) {
        sources.setErrorMessage(error.message);
        sources.announce(error.message);
      }
    },
    onEnd: () => {
      sources.engineLiveRef.current = false;
      sources.engineEndedRef.current = true;
      if (listening()) {
        sources.setPhase('processing');
        sources.requestStop();
      }
      sources.finalize();
    },
  };
}
