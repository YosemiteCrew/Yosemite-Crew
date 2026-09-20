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
  // The desktop app currently ships only `-beta.N` builds, and the beta channel is a
  // superset: electron-updater's prerelease path also picks up stable releases, so a
  // beta default never misses one. Defaulting to `latest` instead resolves the
  // repo-wide "latest release", which in this monorepo is usually another product.
  updateChannel: 'beta',
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
// A real clock time, not just the shape of one. `\d{2}:\d{2}` accepted "25:99",
// which the Preferences page then stored and displayed as a Do Not Disturb
// window that no hour can fall inside (issue #3298).
const isHourMinute = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Returns whether the value was accepted. `normalizeSettings` ignores the
// answer - a rejected field simply keeps its default - but `rejectedSettingKeys`
// needs it, because "the stored value differs from the requested one" cannot
// tell a refusal apart from a value the store legitimately adapts (fontScale is
// quantised to quarter steps, idleLockMinutes is clamped to a day).
type SettingsValidator = (value: unknown, settings: DesktopSettings) => boolean;

// One validator per persisted key. Each ignores values that fail validation so
// a corrupt or partial settings file falls back to the default for that field.
const SETTINGS_VALIDATORS: Partial<Record<keyof DesktopSettings, SettingsValidator>> = {
  updateChannel: (v, s) => {
    if (!isUpdateChannel(v)) return false;
    s.updateChannel = v;
    return true;
  },
  idleLockMinutes: (v, s) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return false;
    s.idleLockMinutes = Math.min(1440, Math.round(v));
    return true;
  },
  telemetryOptIn: (v, s) => {
    if (!isBool(v)) return false;
    s.telemetryOptIn = v;
    return true;
  },
  theme: (v, s) => {
    if (!isThemeMode(v)) return false;
    s.theme = v;
    return true;
  },
  openAtLogin: (v, s) => {
    if (!isBool(v)) return false;
    s.openAtLogin = v;
    return true;
  },
  notificationsEnabled: (v, s) => {
    if (!isBool(v)) return false;
    s.notificationsEnabled = v;
    return true;
  },
  dndStart: (v, s) => {
    if (!isHourMinute(v)) return false;
    s.dndStart = v;
    return true;
  },
  dndEnd: (v, s) => {
    if (!isHourMinute(v)) return false;
    s.dndEnd = v;
    return true;
  },
  biometricLockEnabled: (v, s) => {
    if (!isBool(v)) return false;
    s.biometricLockEnabled = v;
    return true;
  },
  accentColor: (v, s) => {
    if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) return false;
    s.accentColor = v;
    return true;
  },
  fontScale: (v, s) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.5 || v > 2) return false;
    s.fontScale = Math.round(v * 4) / 4;
    return true;
  },
  telehealthProvider: (v, s) => {
    if (!isTelehealthProviderSetting(v)) return false;
    s.telehealthProvider = v;
    return true;
  },
  lastSeenVersion: (v, s) => {
    if (typeof v !== 'string') return false;
    s.lastSeenVersion = v;
    return true;
  },
};

/*
 * The keys present in `raw` that the validators refused. A key with no
 * validator is not reported: it is not persisted at all, so calling it
 * "rejected" would put a field the user cannot see into an error message.
 *
 * Callers use this to tell the user which field was dropped. Without it
 * `yc:set-settings` answered `ok: true` whether or not a value survived, so a
 * partially typed Do Not Disturb time was replaced by the stored one while the
 * page still said "Saved" (issue #3298).
 */
export const rejectedSettingKeys = (raw: unknown): (keyof DesktopSettings)[] => {
  if (!isRecord(raw)) return [];
  const probe: DesktopSettings = { ...DEFAULT_SETTINGS };
  const rejected: (keyof DesktopSettings)[] = [];
  for (const key of SETTINGS_KEYS) {
    if (!(key in raw)) continue;
    const validator = SETTINGS_VALIDATORS[key];
    if (validator && !validator(raw[key], probe)) rejected.push(key);
  }
  return rejected;
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
