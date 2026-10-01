'use client';

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import type { Announce } from './useAnnouncer';

export interface TranscriptReview {
  text: string;
  setSpokenText: (spoken: string) => void;
  clearText: () => void;
  confirm: () => void;
  clear: () => void;
  change: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
}

interface UseTranscriptReviewOptions {
  announce: Announce;
  spokenRef: RefObject<string>;
  onReleaseAudio: () => void;
  onReset: () => void;
  onTranscript?: (transcript: string) => void;
  onCorrection?: (original: string, corrected: string) => void;
}

/**
 * Owns the transcript the user reads and corrects, plus what confirming or
 * clearing it means. It deliberately knows nothing about recording.
 */
export function useTranscriptReview({
  announce,
  spokenRef,
  onReleaseAudio,
  onReset,
  onTranscript,
  onCorrection,
}: UseTranscriptReviewOptions): TranscriptReview {
  const [text, setText] = useState('');

  const setSpokenText = useCallback((spoken: string) => setText(spoken), []);
  const clearText = useCallback(() => setText(''), []);

  const confirm = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const original = spokenRef.current;
    if (original && text !== original) {
      onCorrection?.(original, text);
    }
    onTranscript?.(trimmed);
    onReleaseAudio();
    onReset();
    setText('');
    announce('Transcript confirmed');
  }, [announce, onCorrection, onReleaseAudio, onReset, onTranscript, spokenRef, text]);

  const clear = useCallback(() => {
    onReleaseAudio();
    onReset();
    setText('');
    announce('Voice capture cleared');
  }, [announce, onReleaseAudio, onReset]);

  const change = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        confirm();
      } else if (event.key === 'Escape') {
        clear();
      }
    },
    [clear, confirm]
  );

  return useMemo(
    () => ({ text, setSpokenText, clearText, confirm, clear, change, handleKeyDown }),
    [change, clear, clearText, confirm, handleKeyDown, setSpokenText, text]
  );
}
