'use strict';

import fs from 'node:fs';

export const MDM_FILE_ENV = 'YC_DESKTOP_MDM_FILE';

export const DEFAULT_MDM_PATHS: readonly string[] = Object.freeze([
  '/etc/yosemite-crew/managed-config.json',
  '/Library/Managed Preferences/com.yosemitecrew.pims.plist',
]);

export interface ManagedConfig {
  startUrl?: string;
  allowedOrigins?: string[];
  blockedPathPrefixes?: string[];
  updateChannel?: string;
  disableUpdates?: boolean;
  idleLockMinutes?: number;
  telemetryOptIn?: boolean;
  telemetryUrl?: string;
}

interface MdmDeps {
  readFileSync?: (path: string, encoding: string) => string;
  existsSync?: (path: string) => boolean;
  env?: NodeJS.ProcessEnv;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Minimal parser for a macOS managed-preferences plist (a single top-level
// <dict> of scalar values). Uses a LINEAR regex (no backtracking/`[\s\S]*?`) to
// avoid ReDoS on attacker-controlled file content.
export const parsePlistDict = (xml: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const re =
    /<key>([^<]*)<\/key>\s*(?:<(string|integer|real)>([^<]*)<\/(?:string|integer|real)>|<(true|false)\s*\/>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const key = (m[1] ?? '').trim();
    if (m[4] !== undefined) out[key] = m[4] === 'true';
    else if (m[2] === 'string') out[key] = m[3] ?? '';
    else out[key] = Number(m[3] ?? '');
  }
  return out;
};

export const normalizeManagedConfig = (raw: unknown): ManagedConfig => {
  if (!isRecord(raw)) return {};
  const config: ManagedConfig = {};
  if (typeof raw.startUrl === 'string') config.startUrl = raw.startUrl;
  if (
    Array.isArray(raw.allowedOrigins) &&
    raw.allowedOrigins.every((o): o is string => typeof o === 'string')
  ) {
    config.allowedOrigins = raw.allowedOrigins;
  }
  if (
    Array.isArray(raw.blockedPathPrefixes) &&
    raw.blockedPathPrefixes.every((p): p is string => typeof p === 'string')
  ) {
    config.blockedPathPrefixes = raw.blockedPathPrefixes;
  }
  if (
    typeof raw.updateChannel === 'string' &&
    (raw.updateChannel === 'latest' || raw.updateChannel === 'beta')
  ) {
    config.updateChannel = raw.updateChannel;
  }
  if (typeof raw.disableUpdates === 'boolean') config.disableUpdates = raw.disableUpdates;
  if (
    typeof raw.idleLockMinutes === 'number' &&
    Number.isFinite(raw.idleLockMinutes) &&
    raw.idleLockMinutes >= 0
  ) {
    config.idleLockMinutes = raw.idleLockMinutes;
  }
  if (typeof raw.telemetryOptIn === 'boolean') config.telemetryOptIn = raw.telemetryOptIn;
  if (typeof raw.telemetryUrl === 'string') config.telemetryUrl = raw.telemetryUrl;
  return config;
};

export const resolveMdmPaths = (env: NodeJS.ProcessEnv = process.env): string[] => {
  const customPath = env[MDM_FILE_ENV];
  if (customPath) return [customPath];
  return [...DEFAULT_MDM_PATHS];
};

export const readManagedConfig = (deps: MdmDeps = {}): ManagedConfig => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const existsSync = deps.existsSync || fs.existsSync;
  const env = deps.env || process.env;

  const paths = resolveMdmPaths(env);
  for (const filePath of paths) {
    try {
      if (existsSync(filePath)) {
        const raw = readFileSync(filePath, 'utf8');
        const parsed = filePath.endsWith('.plist') ? parsePlistDict(raw) : JSON.parse(raw);
        return normalizeManagedConfig(parsed);
      }
    } catch {
      // try next path
    }
  }
  return {};
};

export const applyManagedConfig = (
  config: ManagedConfig,
  existing: Record<string, unknown>
): Record<string, unknown> => {
  const result = { ...existing };
  if (config.startUrl) result.startUrl = config.startUrl;
  if (config.updateChannel) result.updateChannel = config.updateChannel;
  if (config.disableUpdates !== undefined) result.disableUpdates = config.disableUpdates;
  if (config.idleLockMinutes !== undefined) result.idleLockMinutes = config.idleLockMinutes;
  if (config.telemetryOptIn !== undefined) result.telemetryOptIn = config.telemetryOptIn;
  if (config.telemetryUrl) result.telemetryUrl = config.telemetryUrl;
  return result;
};

// Translate managed config into the environment variables the rest of the app
// already reads (navigation-policy, updater, idle-lock, telemetry). Pure so it
// can be unit tested; main applies these to process.env at startup.
export const managedConfigToEnv = (config: ManagedConfig): Record<string, string> => {
  const env: Record<string, string> = {};
  if (config.startUrl) env.YC_DESKTOP_START_URL = config.startUrl;
  if (config.allowedOrigins && config.allowedOrigins.length > 0) {
    env.YC_DESKTOP_ALLOWED_ORIGINS = config.allowedOrigins.join(',');
  }
  if (config.blockedPathPrefixes && config.blockedPathPrefixes.length > 0) {
    env.YC_DESKTOP_BLOCKED_PATH_PREFIXES = config.blockedPathPrefixes.join(',');
  }
  if (config.updateChannel) env.YC_DESKTOP_UPDATE_CHANNEL = config.updateChannel;
  if (config.disableUpdates !== undefined)
    env.YC_DESKTOP_DISABLE_UPDATES = config.disableUpdates ? '1' : '0';
  if (config.idleLockMinutes !== undefined)
    env.YC_DESKTOP_IDLE_LOCK_MINUTES = String(config.idleLockMinutes);
  if (config.telemetryOptIn !== undefined)
    env.YC_DESKTOP_TELEMETRY = config.telemetryOptIn ? '1' : '0';
  if (config.telemetryUrl) env.YC_DESKTOP_TELEMETRY_URL = config.telemetryUrl;
  return env;
};
