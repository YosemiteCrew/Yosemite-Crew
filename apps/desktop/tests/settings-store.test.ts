import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  normalizeSettings,
  createSettingsStore,
  isUpdateChannel,
  isThemeMode,
  isTelehealthProviderSetting,
  DEFAULT_SETTINGS,
  type DesktopSettings,
} from '../src/utils/settings-store';

describe('normalizeSettings', () => {
  test('returns defaults for null/undefined/non-object', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('string')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  test('returns defaults for empty object', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test('preserves valid settings', () => {
    const input: Partial<DesktopSettings> = {
      updateChannel: 'beta',
      idleLockMinutes: 30,
      telemetryOptIn: true,
      theme: 'dark',
      openAtLogin: true,
      telehealthProvider: 'getstream',
    };
    const result = normalizeSettings(input);
    expect(result.updateChannel).toBe('beta');
    expect(result.idleLockMinutes).toBe(30);
    expect(result.telemetryOptIn).toBe(true);
    expect(result.theme).toBe('dark');
    expect(result.openAtLogin).toBe(true);
    expect(result.telehealthProvider).toBe('getstream');
  });

  test('ignores unknown keys such as a removed startUrl override', () => {
    const result = normalizeSettings({
      startUrl: 'https://staging.example.com',
    } as Partial<DesktopSettings>);
    expect('startUrl' in result).toBe(false);
  });

  test('clamps idleLockMinutes to valid range', () => {
    expect(normalizeSettings({ idleLockMinutes: -1 }).idleLockMinutes).toBe(0);
    expect(normalizeSettings({ idleLockMinutes: 9999 }).idleLockMinutes).toBe(1440);
    expect(normalizeSettings({ idleLockMinutes: 60.7 }).idleLockMinutes).toBe(61);
    expect(normalizeSettings({ idleLockMinutes: 'abc' }).idleLockMinutes).toBe(0);
  });

  test('rejects invalid updateChannel', () => {
    expect(normalizeSettings({ updateChannel: 'canary' }).updateChannel).toBe('latest');
    expect(normalizeSettings({ updateChannel: 123 }).updateChannel).toBe('latest');
  });

  test('rejects invalid theme', () => {
    expect(normalizeSettings({ theme: 'oled' }).theme).toBe('system');
    expect(normalizeSettings({ theme: '' }).theme).toBe('system');
    expect(normalizeSettings({ theme: true }).theme).toBe('system');
  });

  test('rejects non-boolean telemetryOptIn and openAtLogin', () => {
    expect(normalizeSettings({ telemetryOptIn: 'yes' }).telemetryOptIn).toBe(false);
    expect(normalizeSettings({ openAtLogin: 1 }).openAtLogin).toBe(false);
  });

  test('persists lastSeenVersion', () => {
    expect(normalizeSettings({ lastSeenVersion: '0.1.0-beta.1' }).lastSeenVersion).toBe(
      '0.1.0-beta.1'
    );
    expect(normalizeSettings({ lastSeenVersion: '' }).lastSeenVersion).toBe('');
    expect(normalizeSettings({ lastSeenVersion: 123 }).lastSeenVersion).toBe('');
  });
});

describe('isUpdateChannel', () => {
  test('accepts valid channels', () => {
    expect(isUpdateChannel('latest')).toBe(true);
    expect(isUpdateChannel('beta')).toBe(true);
  });

  test('rejects invalid values', () => {
    expect(isUpdateChannel('canary')).toBe(false);
    expect(isUpdateChannel('')).toBe(false);
    expect(isUpdateChannel(undefined)).toBe(false);
    expect(isUpdateChannel(null)).toBe(false);
  });
});

describe('isThemeMode', () => {
  test('accepts valid themes', () => {
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
  });

  test('rejects invalid values', () => {
    expect(isThemeMode('oled')).toBe(false);
    expect(isThemeMode('')).toBe(false);
    expect(isThemeMode('auto')).toBe(false);
  });
});

describe('isTelehealthProviderSetting', () => {
  test('only accepts GetStream', () => {
    expect(isTelehealthProviderSetting('getstream')).toBe(true);
    expect(isTelehealthProviderSetting('zoom')).toBe(false);
    expect(isTelehealthProviderSetting(undefined)).toBe(false);
  });
});

describe('createSettingsStore', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('load returns defaults when file does not exist', () => {
    const store = createSettingsStore(path.join(tmpDir, 'nonexistent.json'));
    const settings = store.load();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  test('save and load round-trips settings', () => {
    const filePath = path.join(tmpDir, 'roundtrip.json');
    const store = createSettingsStore(filePath);

    const saved = store.save({ theme: 'dark', telemetryOptIn: true });
    expect(saved.theme).toBe('dark');
    expect(saved.telemetryOptIn).toBe(true);

    const loaded = store.load();
    expect(loaded.theme).toBe('dark');
    expect(loaded.telemetryOptIn).toBe(true);
  });

  test('save and load lastSeenVersion round-trips', () => {
    const filePath = path.join(tmpDir, 'version.json');
    const store = createSettingsStore(filePath);

    const saved = store.save({ lastSeenVersion: '0.2.0' });
    expect(saved.lastSeenVersion).toBe('0.2.0');

    const fresh = createSettingsStore(filePath);
    expect(fresh.load().lastSeenVersion).toBe('0.2.0');
  });

  test('save persists to disk', () => {
    const filePath = path.join(tmpDir, 'persist.json');
    const store = createSettingsStore(filePath);

    store.save({ updateChannel: 'beta', idleLockMinutes: 15 });

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(raw.updateChannel).toBe('beta');
    expect(raw.idleLockMinutes).toBe(15);
  });

  test('save with partial update merges with existing', () => {
    const filePath = path.join(tmpDir, 'merge.json');
    const store = createSettingsStore(filePath);

    store.save({ theme: 'light', openAtLogin: true });
    store.save({ telemetryOptIn: true });

    const loaded = store.load();
    expect(loaded.theme).toBe('light');
    expect(loaded.openAtLogin).toBe(true);
    expect(loaded.telemetryOptIn).toBe(true);
    expect(loaded.updateChannel).toBe('latest'); // unchanged from default
  });

  test('load from corrupt file returns defaults', () => {
    const filePath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(filePath, '{ invalid json }', 'utf8');

    const store = createSettingsStore(filePath);
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
  });

  test('filePath property returns the path', () => {
    const store = createSettingsStore('/tmp/test-settings.json');
    expect(store.filePath).toBe('/tmp/test-settings.json');
  });
});
