'use strict';

import type { TelemetryEvent, TelemetryLogger, TelemetrySink } from './telemetry';

export interface TelemetryHttpPayload {
  events: TelemetryEvent[];
  sentAt: string;
}

export interface TelemetryHttpSinkOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  logger?: TelemetryLogger;
  maxBatchSize?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface TelemetryHttpSink extends TelemetrySink {
  flush: () => Promise<boolean>;
  pendingCount: () => number;
  nextDelayMs: () => number;
}

export const telemetryBackoffMs = (
  failureCount: number,
  baseBackoffMs = 1_000,
  maxBackoffMs = 60_000
): number => {
  if (failureCount <= 0) return 0;
  return Math.min(maxBackoffMs, baseBackoffMs * 2 ** (failureCount - 1));
};

export const createTelemetryHttpPayload = (
  events: TelemetryEvent[],
  now: () => Date = () => new Date()
): TelemetryHttpPayload => ({
  events: [...events],
  sentAt: now().toISOString(),
});

export const createTelemetryHttpSink = (options: TelemetryHttpSinkOptions): TelemetryHttpSink => {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => new Date());
  const maxBatchSize = options.maxBatchSize || 20;
  const baseBackoffMs = options.baseBackoffMs || 1_000;
  const maxBackoffMs = options.maxBackoffMs || 60_000;
  const queue: TelemetryEvent[] = [];
  let failureCount = 0;
  let lastFailureAt = 0;

  // Remaining backoff: the full window for the current failureCount minus the
  // time elapsed since the last failure. Returns 0 once the window has passed so
  // a later flush actually retries instead of being stranded forever.
  const nextDelayMs = (): number => {
    const window = telemetryBackoffMs(failureCount, baseBackoffMs, maxBackoffMs);
    if (window <= 0) return 0;
    const elapsed = now().getTime() - lastFailureAt;
    return Math.max(0, window - elapsed);
  };

  const flush = async (): Promise<boolean> => {
    if (queue.length === 0) return true;
    if (nextDelayMs() > 0) return false;

    const batch = queue.slice(0, maxBatchSize);
    try {
      const response = await fetchImpl(options.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createTelemetryHttpPayload(batch, now)),
      });
      if (!response.ok) throw new Error(`telemetry upload failed: ${response.status}`);
      queue.splice(0, batch.length);
      failureCount = 0;
      lastFailureAt = 0;
      return true;
    } catch (error) {
      failureCount += 1;
      lastFailureAt = now().getTime();
      options.logger?.warn('telemetry_http_upload_failed', {
        error,
        delayMs: nextDelayMs(),
      });
      return false;
    }
  };

  return {
    send(event) {
      queue.push(event);
      void flush();
    },
    flush,
    pendingCount: () => queue.length,
    nextDelayMs,
  };
};
