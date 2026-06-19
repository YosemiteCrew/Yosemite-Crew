import {
  normalizeManagedConfig,
  resolveMdmPaths,
  readManagedConfig,
  applyManagedConfig,
  managedConfigToEnv,
  DEFAULT_MDM_PATHS,
  MDM_FILE_ENV,
} from '../src/utils/mdm';

describe('normalizeManagedConfig', () => {
  test('returns empty object for non-object input', () => {
    expect(normalizeManagedConfig(null)).toEqual({});
    expect(normalizeManagedConfig('string')).toEqual({});
    expect(normalizeManagedConfig(undefined)).toEqual({});
  });

  test('extracts valid fields', () => {
    const result = normalizeManagedConfig({
      startUrl: 'https://managed.example.com',
      allowedOrigins: ['https://a.com', 'https://b.com'],
      idleLockMinutes: 30,
      disableUpdates: true,
    });
    expect(result.startUrl).toBe('https://managed.example.com');
    expect(result.allowedOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(result.idleLockMinutes).toBe(30);
    expect(result.disableUpdates).toBe(true);
  });

  test('rejects invalid fields', () => {
    const result = normalizeManagedConfig({
      startUrl: 123,
      idleLockMinutes: -1,
      updateChannel: 'invalid',
    });
    expect(result.startUrl).toBeUndefined();
    expect(result.idleLockMinutes).toBeUndefined();
    expect(result.updateChannel).toBeUndefined();
  });
});

describe('resolveMdmPaths', () => {
  test('returns custom path when env var is set', () => {
    const paths = resolveMdmPaths({ [MDM_FILE_ENV]: '/custom/path.json' });
    expect(paths).toEqual(['/custom/path.json']);
  });

  test('returns default paths when env var is not set', () => {
    const paths = resolveMdmPaths({});
    expect(paths).toEqual([...DEFAULT_MDM_PATHS]);
  });
});

describe('readManagedConfig', () => {
  test('returns empty config when no file exists', () => {
    const config = readManagedConfig({
      existsSync: () => false,
      readFileSync: () => '',
    });
    expect(config).toEqual({});
  });

  test('reads and parses managed config file', () => {
    const config = readManagedConfig({
      existsSync: () => true,
      readFileSync: () =>
        JSON.stringify({
          startUrl: 'https://mdm.example.com',
          idleLockMinutes: 60,
        }),
    });
    expect(config.startUrl).toBe('https://mdm.example.com');
    expect(config.idleLockMinutes).toBe(60);
  });

  test('returns empty on parse error', () => {
    const config = readManagedConfig({
      existsSync: () => true,
      readFileSync: () => 'not-json',
    });
    expect(config).toEqual({});
  });

  test('parses a macOS .plist managed-preferences file', () => {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startUrl</key>
  <string>https://plist.example.com/signin</string>
  <key>updateChannel</key>
  <string>beta</string>
  <key>idleLockMinutes</key>
  <integer>20</integer>
  <key>disableUpdates</key>
  <true/>
</dict>
</plist>`;
    const config = readManagedConfig({
      existsSync: (p: string) => p.endsWith('.plist'),
      readFileSync: () => plist,
    });
    expect(config.startUrl).toBe('https://plist.example.com/signin');
    expect(config.updateChannel).toBe('beta');
    expect(config.idleLockMinutes).toBe(20);
    expect(config.disableUpdates).toBe(true);
  });

  test('tries custom path from env first', () => {
    let triedPath = '';
    readManagedConfig({
      existsSync: (p: string) => {
        triedPath = p;
        return false;
      },
      readFileSync: () => '',
      env: { [MDM_FILE_ENV]: '/custom/mdm.json' },
    });
    expect(triedPath).toBe('/custom/mdm.json');
  });
});

describe('applyManagedConfig', () => {
  test('overrides values from managed config', () => {
    const result = applyManagedConfig(
      {
        startUrl: 'https://mdm.example.com',
        idleLockMinutes: 30,
        disableUpdates: true,
      },
      { startUrl: 'https://default.example.com', idleLockMinutes: 0 }
    );
    expect(result.startUrl).toBe('https://mdm.example.com');
    expect(result.idleLockMinutes).toBe(30);
    expect(result.disableUpdates).toBe(true);
  });

  test('preserves existing values when not overridden', () => {
    const result = applyManagedConfig(
      { startUrl: 'https://mdm.example.com' },
      { existingKey: 'value', otherKey: 42 }
    );
    expect(result.startUrl).toBe('https://mdm.example.com');
    expect(result.existingKey).toBe('value');
    expect(result.otherKey).toBe(42);
  });

  test('does not override when managed value is undefined', () => {
    const result = applyManagedConfig({}, { startUrl: 'https://default.example.com' });
    expect(result.startUrl).toBe('https://default.example.com');
  });
});

describe('managedConfigToEnv', () => {
  test('maps managed fields to the env vars the app reads', () => {
    const env = managedConfigToEnv({
      startUrl: 'https://clinic.example.com/signin',
      allowedOrigins: ['https://clinic.example.com', 'https://cdn.example.com'],
      blockedPathPrefixes: ['/developers'],
      updateChannel: 'beta',
      disableUpdates: true,
      idleLockMinutes: 15,
      telemetryOptIn: true,
      telemetryUrl: 'https://t.example.com',
    });
    expect(env).toEqual({
      YC_DESKTOP_START_URL: 'https://clinic.example.com/signin',
      YC_DESKTOP_ALLOWED_ORIGINS: 'https://clinic.example.com,https://cdn.example.com',
      YC_DESKTOP_BLOCKED_PATH_PREFIXES: '/developers',
      YC_DESKTOP_UPDATE_CHANNEL: 'beta',
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_IDLE_LOCK_MINUTES: '15',
      YC_DESKTOP_TELEMETRY: '1',
      YC_DESKTOP_TELEMETRY_URL: 'https://t.example.com',
    });
  });

  test('emits only present keys; booleans map to 0/1; empty arrays skipped', () => {
    expect(managedConfigToEnv({})).toEqual({});
    expect(managedConfigToEnv({ disableUpdates: false, telemetryOptIn: false })).toEqual({
      YC_DESKTOP_DISABLE_UPDATES: '0',
      YC_DESKTOP_TELEMETRY: '0',
    });
    expect(managedConfigToEnv({ allowedOrigins: [] })).toEqual({});
  });
});
