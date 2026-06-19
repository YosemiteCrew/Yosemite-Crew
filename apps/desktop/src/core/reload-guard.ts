'use strict';

// Guards against an infinite reload loop when the renderer keeps crashing.
// Pure and dependency-free so it can be unit tested without Electron.

export interface ReloadGuardOptions {
  maxReloads?: number;
  windowMs?: number;
  now?: () => number;
}

export interface ReloadGuard {
  /** Records a recovery attempt and returns true if a reload is still within budget. */
  shouldReload: () => boolean;
  /** Clears the recorded attempts (call after a successful load). */
  reset: () => void;
}

const DEFAULT_MAX_RELOADS = 3;
const DEFAULT_WINDOW_MS = 30_000;

export const createReloadGuard = (options: ReloadGuardOptions = {}): ReloadGuard => {
  const maxReloads = options.maxReloads ?? DEFAULT_MAX_RELOADS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? Date.now;

  let attempts: number[] = [];

  const shouldReload = (): boolean => {
    const cutoff = now() - windowMs;
    attempts = attempts.filter((timestamp) => timestamp > cutoff);
    if (attempts.length >= maxReloads) return false;
    attempts.push(now());
    return true;
  };

  const reset = (): void => {
    attempts = [];
  };

  return { shouldReload, reset };
};
