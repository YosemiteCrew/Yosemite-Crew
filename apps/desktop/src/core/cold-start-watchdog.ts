'use strict';

export const shouldRetryColdStart = (url: string, hasRetried: boolean): boolean =>
  !hasRetried && (!url || url === 'about:blank');

export interface ColdStartWatchdogOptions {
  timeoutMs?: number;
  now?: () => number;
}

export interface ColdStartWatchdog {
  start: () => void;
  cancel: () => void;
}

export const createColdStartWatchdog = (
  opts: {
    getUrl: () => string;
    onRetry: () => void;
    logger?: { info: (event: string, data?: unknown) => void };
  } & ColdStartWatchdogOptions
): ColdStartWatchdog => {
  const timeoutMs = opts.timeoutMs ?? 6000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retried = false;

  const check = (): void => {
    if (!shouldRetryColdStart(opts.getUrl(), retried)) return;
    retried = true;
    opts.logger?.info?.('cold_start_recovered', { url: opts.getUrl() });
    opts.onRetry();
  };

  const start = (): void => {
    if (timer !== null) return;
    timer = setTimeout(check, timeoutMs);
  };

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { start, cancel };
};
