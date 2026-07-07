/**
 * Session-scoped settings for the Agent Playground.
 *
 * Per ADR 0005 the BYO inference key lives in browser sessionStorage ONLY -
 * never a cookie, never localStorage, never sent to Yosemite Crew servers.
 * Everything here goes away when the browser tab session ends.
 */
import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';

export const PLAYGROUND_STORAGE_KEYS = {
  anthropicKey: 'playgroundAnthropicKey',
  yosemiteKey: 'playgroundYosemiteKey',
  baseUrl: 'playgroundBaseUrl',
  model: 'playgroundModel',
} as const;

export type PlaygroundSettingField = keyof typeof PLAYGROUND_STORAGE_KEYS;

export type PlaygroundSettings = Record<PlaygroundSettingField, string>;

export const DEFAULT_PLAYGROUND_MODEL = 'claude-sonnet-5';

export const PLAYGROUND_MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (recommended)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (lower cost)' },
] as const;

export const getDefaultBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

export const getDefaultPlaygroundSettings = (): PlaygroundSettings => ({
  anthropicKey: '',
  yosemiteKey: '',
  baseUrl: getDefaultBaseUrl(),
  model: DEFAULT_PLAYGROUND_MODEL,
});

/** Loads settings from sessionStorage, falling back to safe defaults. */
export const loadPlaygroundSettings = (): PlaygroundSettings => {
  const defaults = getDefaultPlaygroundSettings();
  const settings = { ...defaults };
  (Object.keys(PLAYGROUND_STORAGE_KEYS) as PlaygroundSettingField[]).forEach((field) => {
    const stored = getStorageItem('session', PLAYGROUND_STORAGE_KEYS[field]);
    if (stored) settings[field] = stored;
  });
  return settings;
};

/** Persists a single setting to sessionStorage; empty values are removed. */
export const savePlaygroundSetting = (field: PlaygroundSettingField, value: string): void => {
  if (value) {
    setStorageItem('session', PLAYGROUND_STORAGE_KEYS[field], value);
  } else {
    removeStorageItem('session', PLAYGROUND_STORAGE_KEYS[field]);
  }
};

/** Removes both API keys from sessionStorage. */
export const clearPlaygroundKeys = (): void => {
  removeStorageItem('session', PLAYGROUND_STORAGE_KEYS.anthropicKey);
  removeStorageItem('session', PLAYGROUND_STORAGE_KEYS.yosemiteKey);
};
