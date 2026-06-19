'use strict';

export const TELEHEALTH_PROVIDER_ID = 'getstream' as const;
export type TelehealthProviderId = typeof TELEHEALTH_PROVIDER_ID;

export interface TelehealthProvider {
  id: TelehealthProviderId;
  name: string;
  backend: 'getstream';
  supportsWaitingRoom: boolean;
  supportsRecording: boolean;
  supportsScreenShare: boolean;
  supportsDevicePicker: boolean;
}

export interface TelehealthLaunchIntent {
  appointmentId?: string;
  callId?: string;
  companionId?: string;
}

export interface ParsedTelehealthIntent {
  ok: true;
  intent: TelehealthLaunchIntent;
}

export interface TelehealthIntentError {
  ok: false;
  error: string;
}

export const STREAM_TELEHEALTH_PROVIDER: TelehealthProvider = {
  id: TELEHEALTH_PROVIDER_ID,
  name: 'GetStream Telehealth',
  backend: 'getstream',
  supportsWaitingRoom: true,
  supportsRecording: true,
  supportsScreenShare: true,
  supportsDevicePicker: true,
};

export const BUILTIN_PROVIDERS: Record<TelehealthProviderId, TelehealthProvider> = {
  [TELEHEALTH_PROVIDER_ID]: STREAM_TELEHEALTH_PROVIDER,
};

const MAX_ID_LENGTH = 128;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH || !SAFE_ID_PATTERN.test(trimmed))
    return undefined;
  return trimmed;
};

export const getProvider = (id: string): TelehealthProvider | undefined =>
  id === TELEHEALTH_PROVIDER_ID ? STREAM_TELEHEALTH_PROVIDER : undefined;

export const listProviders = (): TelehealthProvider[] => [STREAM_TELEHEALTH_PROVIDER];

export const streamCallIdForAppointment = (appointmentId: string): string | null => {
  const clean = cleanId(appointmentId);
  return clean ? `yc-appt-${clean}` : null;
};

export const resolveStreamCallId = (intent: TelehealthLaunchIntent): string | null => {
  const explicit = cleanId(intent.callId);
  if (explicit) return explicit;
  return intent.appointmentId ? streamCallIdForAppointment(intent.appointmentId) : null;
};

export const parseTelehealthLaunchInput = (
  raw?: unknown
): ParsedTelehealthIntent | TelehealthIntentError => {
  if (raw === undefined || raw === null) return { ok: true, intent: {} };
  if (!isRecord(raw)) return { ok: false, error: 'invalid-telehealth-intent' };

  const appointmentId = cleanId(raw.appointmentId);
  const callId = cleanId(raw.callId);
  const companionId = cleanId(raw.companionId);

  if (raw.appointmentId !== undefined && !appointmentId)
    return { ok: false, error: 'invalid-appointment-id' };
  if (raw.callId !== undefined && !callId) return { ok: false, error: 'invalid-call-id' };
  if (raw.companionId !== undefined && !companionId)
    return { ok: false, error: 'invalid-companion-id' };

  return {
    ok: true,
    intent: {
      ...(appointmentId ? { appointmentId } : {}),
      ...(callId ? { callId } : {}),
      ...(companionId ? { companionId } : {}),
    },
  };
};

export const buildTelehealthPath = (intent: TelehealthLaunchIntent = {}): string => {
  const params = new URLSearchParams({
    action: 'telehealth',
    provider: TELEHEALTH_PROVIDER_ID,
  });
  const callId = resolveStreamCallId(intent);
  if (callId) params.set('callId', callId);
  if (intent.appointmentId) params.set('appointmentId', intent.appointmentId);
  if (intent.companionId) params.set('companionId', intent.companionId);
  return `/appointments?${params.toString()}`;
};

export const buildTelehealthUrl = (
  startUrl: string,
  intent: TelehealthLaunchIntent = {}
): string => {
  const url = new URL(buildTelehealthPath(intent), startUrl);
  return url.href;
};

export const buildTelehealthDeepLink = (intent: TelehealthLaunchIntent = {}): string =>
  `yosemitecrew://${buildTelehealthPath(intent).replace(/^\//, '')}`;
