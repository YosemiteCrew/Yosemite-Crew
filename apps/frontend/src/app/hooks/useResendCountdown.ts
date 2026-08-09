import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Countdown for OTP resend prompts. Deadline-based so a slow render can't
 * drift the clock: the remaining time is always derived from Date.now().
 * Restarts automatically whenever `active` flips to true.
 *
 * The ticking clock is an external mutable source, so it lives in a small
 * per-instance store that React subscribes to via useSyncExternalStore —
 * effects only push the `active`/duration props into the store.
 */
type CountdownStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSecondsLeft: () => number | null;
  start: (durationMs: number) => void;
  stop: () => void;
  pause: () => void;
};

const createCountdownStore = (): CountdownStore => {
  const listeners = new Set<() => void>();
  let deadlineMs: number | null = null;
  let secondsLeft: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const notify = () => listeners.forEach((listener) => listener());
  const clearTick = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
  const tick = () => {
    if (deadlineMs === null) return;
    secondsLeft = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
    if (secondsLeft === 0) clearTick();
    notify();
  };

  return {
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    getSecondsLeft: () => secondsLeft,
    start: (durationMs) => {
      deadlineMs = Date.now() + durationMs;
      secondsLeft = Math.max(0, Math.ceil(durationMs / 1000));
      clearTick();
      intervalId = setInterval(tick, 1000);
      notify();
    },
    stop: () => {
      if (deadlineMs === null) return;
      deadlineMs = null;
      secondsLeft = null;
      clearTick();
      notify();
    },
    pause: clearTick,
  };
};

// Server render never has a running countdown.
const getServerSecondsLeft = () => null;

export const useResendCountdown = (active: boolean, durationSeconds: number) => {
  const [store] = useState(createCountdownStore);
  const runningSecondsLeft = useSyncExternalStore(
    store.subscribe,
    store.getSecondsLeft,
    getServerSecondsLeft
  );

  const restart = useCallback(() => store.start(durationSeconds * 1000), [durationSeconds, store]);

  useEffect(() => {
    if (!active) {
      store.stop();
      return;
    }
    store.start(durationSeconds * 1000);
    return () => store.pause();
  }, [active, durationSeconds, store]);

  const secondsLeft = runningSecondsLeft ?? durationSeconds;

  return { restart, secondsLeft };
};
