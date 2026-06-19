'use strict';

export const TELEMETRY_ENV = 'YC_DESKTOP_TELEMETRY';

export type TelemetryEventType = 'error' | 'usage';

export interface TelemetryEvent {
  type: TelemetryEventType;
  name: string;
  count: number;
}

export interface TelemetrySink {
  send: (event: TelemetryEvent) => void | Promise<void>;
}

export interface TelemetryLogger {
  warn: (event: string, data?: unknown) => void;
}

export interface TelemetryClient {
  enabled: boolean;
  recordUsage: (name: string, count?: number) => boolean;
  recordError: (name: string, count?: number) => boolean;
}

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_:. -]{0,79}$/i;

export const isTelemetryEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env[TELEMETRY_ENV] === '1';

export const sanitizeTelemetryName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!EVENT_NAME_PATTERN.test(trimmed)) return null;
  if (trimmed.includes('@') || trimmed.includes('/') || trimmed.includes('\\')) return null;
  return trimmed;
};

export const createTelemetryEvent = (
  type: TelemetryEventType,
  name: string,
  count = 1
): TelemetryEvent | null => {
  const safeName = sanitizeTelemetryName(name);
  if (!safeName || !Number.isInteger(count) || count <= 0 || count > 10_000) return null;
  return { type, name: safeName, count };
};

export const createTelemetryClient = (
  sink: TelemetrySink,
  env: NodeJS.ProcessEnv = process.env,
  logger?: TelemetryLogger
): TelemetryClient => {
  const enabled = isTelemetryEnabled(env);

  const record = (type: TelemetryEventType, name: string, count = 1): boolean => {
    if (!enabled) return false;
    const event = createTelemetryEvent(type, name, count);
    if (!event) {
      logger?.warn('telemetry_event_rejected', { type, name });
      return false;
    }

    try {
      const result = sink.send(event);
      if (result && typeof result.catch === 'function') {
        void result.catch((error) => logger?.warn('telemetry_send_failed', { error }));
      }
      return true;
    } catch (error) {
      logger?.warn('telemetry_send_failed', { error });
      return false;
    }
  };

  return {
    enabled,
    recordUsage: (name, count) => record('usage', name, count),
    recordError: (name, count) => record('error', name, count),
  };
};
