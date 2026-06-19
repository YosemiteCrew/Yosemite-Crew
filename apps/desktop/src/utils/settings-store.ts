'use strict';

import fs from 'node:fs';
import path from 'node:path';

export const SETTINGS_FILENAME = 'settings.json';

export type UpdateChannel = 'latest' | 'beta';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TelehealthProviderSetting = 'getstream';

export interface DesktopSettings {
  updateChannel: UpdateChannel;
  idleLockMinutes: number;
  telemetryOptIn: boolean;
  theme: ThemeMode;
  openAtLogin: boolean;
  notificationsEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  biometricLockEnabled: boolean;
  accentColor: string;
  fontScale: number;
  telehealthProvider: TelehealthProviderSetting;
  lastSeenVersion: string;
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  updateChannel: 'latest',
  idleLockMinutes: 0,
  telemetryOptIn: false,
  theme: 'system',
  openAtLogin: false,
  notificationsEnabled: true,
  dndStart: '22:00',
  dndEnd: '07:00',
  biometricLockEnabled: false,
  accentColor: '#3b87ec',
  fontScale: 1,
  telehealthProvider: 'getstream',
  lastSeenVersion: '',
};

const SETTINGS_KEYS: (keyof DesktopSettings)[] = [
  'updateChannel',
  'idleLockMinutes',
  'telemetryOptIn',
  'theme',
  'openAtLogin',
  'notificationsEnabled',
  'dndStart',
  'dndEnd',
  'biometricLockEnabled',
  'accentColor',
  'fontScale',
  'telehealthProvider',
  'lastSeenVersion',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isUpdateChannel = (value: unknown): value is UpdateChannel =>
  value === 'latest' || value === 'beta';

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export const isTelehealthProviderSetting = (value: unknown): value is TelehealthProviderSetting =>
  value === 'getstream';

const isBool = (value: unknown): value is boolean => typeof value === 'boolean';
const isHourMinute = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

type SettingsValidator = (value: unknown, settings: DesktopSettings) => void;

// One validator per persisted key. Each ignores values that fail validation so
// a corrupt or partial settings file falls back to the default for that field.
const SETTINGS_VALIDATORS: Partial<Record<keyof DesktopSettings, SettingsValidator>> = {
  updateChannel: (v, s) => {
    if (isUpdateChannel(v)) s.updateChannel = v;
  },
  idleLockMinutes: (v, s) => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      s.idleLockMinutes = Math.min(1440, Math.round(v));
    }
  },
  telemetryOptIn: (v, s) => {
    if (isBool(v)) s.telemetryOptIn = v;
  },
  theme: (v, s) => {
    if (isThemeMode(v)) s.theme = v;
  },
  openAtLogin: (v, s) => {
    if (isBool(v)) s.openAtLogin = v;
  },
  notificationsEnabled: (v, s) => {
    if (isBool(v)) s.notificationsEnabled = v;
  },
  dndStart: (v, s) => {
    if (isHourMinute(v)) s.dndStart = v;
  },
  dndEnd: (v, s) => {
    if (isHourMinute(v)) s.dndEnd = v;
  },
  biometricLockEnabled: (v, s) => {
    if (isBool(v)) s.biometricLockEnabled = v;
  },
  accentColor: (v, s) => {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) s.accentColor = v;
  },
  fontScale: (v, s) => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0.5 && v <= 2) {
      s.fontScale = Math.round(v * 4) / 4;
    }
  },
  telehealthProvider: (v, s) => {
    if (isTelehealthProviderSetting(v)) s.telehealthProvider = v;
  },
  lastSeenVersion: (v, s) => {
    if (typeof v === 'string') s.lastSeenVersion = v;
  },
};

export const normalizeSettings = (raw: unknown): DesktopSettings => {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };

  const settings: DesktopSettings = { ...DEFAULT_SETTINGS };
  for (const key of SETTINGS_KEYS) {
    if (key in raw) SETTINGS_VALIDATORS[key]?.(raw[key], settings);
  }
  return settings;
};

export interface SettingsStore {
  load: () => DesktopSettings;
  save: (partial: Partial<DesktopSettings>) => DesktopSettings;
  filePath: string;
}

interface StoreDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
}

export const createSettingsStore = (filePath: string, deps: StoreDeps = {}): SettingsStore => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;

  let cached: DesktopSettings | null = null;

  const load = (): DesktopSettings => {
    try {
      const raw = readFileSync(filePath, 'utf8');
      cached = normalizeSettings(JSON.parse(raw));
    } catch {
      cached = { ...DEFAULT_SETTINGS };
    }
    return { ...cached };
  };

  const save = (partial: Partial<DesktopSettings>): DesktopSettings => {
    cached ??= load();
    const merged = { ...cached, ...partial };
    cached = normalizeSettings(merged);
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(cached, null, 2), 'utf8');
    } catch {
      // persist must never break the app
    }
    return { ...cached };
  };

  return { load, save, filePath };
};
