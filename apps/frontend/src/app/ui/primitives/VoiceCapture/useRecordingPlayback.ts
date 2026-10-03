'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Announce } from './useAnnouncer';

export interface RecordingPlayback {
  isPlaying: boolean;
  attachRecording: (chunks: Blob[]) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  releaseAudio: () => void;
}

export function useRecordingPlayback(announce: Announce): RecordingPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const releaseAudio = useCallback(() => {
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
    setIsPlaying(false);
  }, []);

  const attachRecording = useCallback((chunks: Blob[]) => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioElementRef.current = audio;
    audio.onended = () => {
      if (!unmountedRef.current) setIsPlaying(false);
    };
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioElementRef.current;
    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
      announce('Playback paused');
      return;
    }
    audio?.play().catch(() => {
      announce('Could not start playback');
    });
    setIsPlaying(true);
    announce('Playing recording');
  }, [isPlaying, announce]);

  const stopPlayback = useCallback(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    announce('Playback stopped');
  }, [announce]);

  return { isPlaying, attachRecording, togglePlayback, stopPlayback, releaseAudio };
}
