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

interface ActiveCapture {
  recorder: MediaRecorder;
  chunks: Blob[];
  onStopped: (chunks: Blob[]) => void;
}

/**
 * Owns the recorder and the microphone track, and nothing else. The caller
 * decides what "stopped" means and cleans up in its own order, so the teardown
 * sequence stays with whoever also owns the session state.
 */
export function useMicrophoneCapture(): MicrophoneCapture {
  const captureRef = useRef<ActiveCapture | null>(null);
  const stopRequestedRef = useRef(false);
  const liveRef = useRef(true);

  const releaseMicrophone = useCallback(() => {
    captureRef.current?.recorder.stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCapture = useCallback(async (onStopped: (chunks: Blob[]) => void) => {
    captureRef.current = null;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      if (!liveRef.current) {
        // The panel went away while the browser was still asking for the
        // microphone. Release it rather than opening a recorder nobody can stop.
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      const recorder = new MediaRecorder(stream, { mimeType: getMediaRecorderType() });
      const capture: ActiveCapture = { recorder, chunks: [], onStopped };
      captureRef.current = capture;
      stopRequestedRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) capture.chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (captureRef.current !== capture) return;
        capture.onStopped(capture.chunks);
      };
      recorder.start(50);
      return true;
    } catch (error) {
      captureRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }, []);

  const requestStop = useCallback(() => {
    if (stopRequestedRef.current) return;
    stopRequestedRef.current = true;
    const capture = captureRef.current;
    const recorder = capture?.recorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      capture?.onStopped(capture.chunks);
    }
  }, []);

  const stopRecorder = useCallback(() => {
    const recorder = captureRef.current?.recorder;
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
