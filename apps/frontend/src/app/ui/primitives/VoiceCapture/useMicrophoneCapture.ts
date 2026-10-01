'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

const getMediaRecorderType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : undefined;
};

export interface MicrophoneCapture {
  startCapture: (onStopped: (chunks: Blob[]) => void) => Promise<boolean>;
  requestStop: () => void;
  stopRecorder: () => void;
  releaseMicrophone: () => void;
}

/**
 * Owns the recorder and the microphone track, and nothing else. The caller
 * decides what "stopped" means and cleans up in its own order, so the teardown
 * sequence stays with whoever also owns the session state.
 */
export function useMicrophoneCapture(): MicrophoneCapture {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onStoppedRef = useRef<((chunks: Blob[]) => void) | null>(null);
  const stopRequestedRef = useRef(false);
  const liveRef = useRef(true);

  const releaseMicrophone = useCallback(() => {
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCapture = useCallback(async (onStopped: (chunks: Blob[]) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    onStoppedRef.current = onStopped;
    if (!liveRef.current) {
      // The panel went away while the browser was still asking for the
      // microphone. Release it rather than opening a recorder nobody can stop.
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }
    const recorder = new MediaRecorder(stream, { mimeType: getMediaRecorderType() });
    chunksRef.current = [];
    stopRequestedRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => onStoppedRef.current?.(chunksRef.current);
    recorderRef.current = recorder;
    recorder.start(50);
    return true;
  }, []);

  const requestStop = useCallback(() => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      onStoppedRef.current?.(chunksRef.current);
    }
  }, []);

  const stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  // Only tracks whether this panel is still on screen, so that a microphone
  // prompt that resolves after the caller went away does not open a recorder.
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  // Stable identity: callers put this in effect dependency lists.
  return useMemo(
    () => ({ startCapture, requestStop, stopRecorder, releaseMicrophone }),
    [startCapture, releaseMicrophone, requestStop, stopRecorder]
  );
}
