import { useCallback, useEffect, useState } from 'react';

/**
 * Countdown for OTP resend prompts. Deadline-based so a slow render can't
 * drift the clock: the remaining time is always derived from Date.now().
 * Restarts automatically whenever `active` flips to true.
 */
export const useResendCountdown = (active: boolean, durationSeconds: number) => {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const restart = useCallback(() => {
    const startedAtMs = Date.now();
    setNowMs(startedAtMs);
    setDeadline(startedAtMs + durationSeconds * 1000);
  }, [durationSeconds]);

  useEffect(() => {
    if (active) restart();
    else setDeadline(null);
  }, [active, restart]);

  const expired = deadline !== null && nowMs >= deadline;

  useEffect(() => {
    if (!active || deadline === null || expired) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active, deadline, expired]);

  const secondsLeft =
    deadline === null ? durationSeconds : Math.max(0, Math.ceil((deadline - nowMs) / 1000));

  return { restart, secondsLeft };
};
