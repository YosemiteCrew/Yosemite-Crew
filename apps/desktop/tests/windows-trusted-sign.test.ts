import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

type SpawnCall = {
  command: string;
  args: string[];
  options: Record<string, unknown>;
};

type SignDeps = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  spawn?: (command: string, args: string[], options: Record<string, unknown>) => EventEmitter;
};

type WindowsSignModule = {
  (configuration: { path?: string }, packager?: unknown, deps?: SignDeps): Promise<void>;
  REQUIRED_AZURE_ENV: string[];
  buildEndpointProbeScript: (config: TrustedSigningConfig) => string;
  buildInvokeTrustedSigningScript: (filePath: string, config: TrustedSigningConfig) => string;
  getMissingAzureEnv: (env?: NodeJS.ProcessEnv) => string[];
  getTrustedSigningConfig: (env?: NodeJS.ProcessEnv) => TrustedSigningConfig;
  runPreflight: (deps?: SignDeps) => Promise<void>;
};

type TrustedSigningConfig = {
  endpoint: string;
  codeSigningAccountName: string;
  certificateProfileName: string;
  timestampRfc3161: string;
  timestampDigest: string;
  fileDigest: string;
};

type FakeChild = EventEmitter & {
  killed: boolean;
  kill: jest.Mock<boolean, []>;
};

const loadWindowsSign = (): WindowsSignModule => {
  const scriptRequire = createRequire(__filename);
  const modulePath = scriptRequire.resolve('../scripts/windows-trusted-sign.js');
  delete scriptRequire.cache[modulePath];
  return scriptRequire('../scripts/windows-trusted-sign.js') as WindowsSignModule;
};

let windowsSign: WindowsSignModule;

const createValidEnv = (): NodeJS.ProcessEnv => ({
  AZURE_TENANT_ID: 'tenant-id',
  AZURE_CLIENT_ID: 'client-id',
  AZURE_CLIENT_SECRET: 'client-secret',
});

const createSuccessfulSpawn = () => {
  const calls: SpawnCall[] = [];
  const spawn = jest.fn((command: string, args: string[], options: Record<string, unknown>) => {
    calls.push({ command, args, options });
    const child = new EventEmitter() as FakeChild;
    child.killed = false;
    child.kill = jest.fn(() => {
      child.killed = true;
      return true;
    });
    process.nextTick(() => child.emit('close', 0, null));
    return child;
  });
  return { calls, spawn };
};

describe('windows trusted signing hook', () => {
  beforeEach(() => {
    windowsSign = loadWindowsSign();
    jest.restoreAllMocks();
  });

  test('reports missing Azure credential environment variables', () => {
    expect(windowsSign.getMissingAzureEnv({ AZURE_TENANT_ID: '  ' })).toEqual([
      'AZURE_TENANT_ID',
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
    ]);
  });

  test('uses Yosemite Crew trusted signing defaults unless env overrides them', () => {
    expect(windowsSign.getTrustedSigningConfig()).toMatchObject({
      endpoint: 'https://swn.codesigning.azure.net/',
      codeSigningAccountName: 'yc-signing',
      certificateProfileName: 'yc-public-trust',
    });

    expect(
      windowsSign.getTrustedSigningConfig({
        AZURE_TRUSTED_SIGNING_ENDPOINT: 'https://example.codesigning.azure.net/',
        AZURE_TRUSTED_SIGNING_ACCOUNT: 'account',
        AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE: 'profile',
      })
    ).toMatchObject({
      endpoint: 'https://example.codesigning.azure.net/',
      codeSigningAccountName: 'account',
      certificateProfileName: 'profile',
    });
  });

  test('quotes PowerShell values and invokes Trusted Signing through splatting', () => {
    const script = windowsSign.buildInvokeTrustedSigningScript(
      "C:/dist/Yosemite Crew's PIMS.exe",
      windowsSign.getTrustedSigningConfig()
    );

    expect(script).toContain("Files = 'C:/dist/Yosemite Crew''s PIMS.exe'");
    expect(script).toContain('Invoke-TrustedSigning @params');
    expect(script).not.toContain('`');
  });

  test('skips unsigned local builds when signing credentials are absent', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { spawn } = createSuccessfulSpawn();

    await windowsSign({ path: 'C:/dist/app.exe' }, undefined, {
      env: {},
      platform: 'win32',
      spawn,
    });

    expect(spawn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[windows-sign] Skipping unsigned local build; missing AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.'
    );
  });

  test('fails closed in CI when signing credentials are absent', async () => {
    await expect(
      windowsSign({ path: 'C:/dist/app.exe' }, undefined, {
        env: { CI: 'true' },
        platform: 'win32',
      })
    ).rejects.toThrow(
      'Missing Azure Trusted Signing environment variables: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET'
    );
  });

  test('does not allow the skip flag when signing is required', async () => {
    const { spawn } = createSuccessfulSpawn();

    await expect(
      windowsSign({ path: 'C:/dist/app.exe' }, undefined, {
        env: { CI: 'true', YC_DESKTOP_SKIP_WINDOWS_SIGNING: '1' },
        platform: 'win32',
        spawn,
      })
    ).rejects.toThrow('Windows signing skip is not allowed when signing is required.');
    expect(spawn).not.toHaveBeenCalled();
  });

  test('preflight requires a Windows runner after credentials are present', async () => {
    await expect(
      windowsSign.runPreflight({
        env: createValidEnv(),
        platform: 'darwin',
      })
    ).rejects.toThrow('Windows Trusted Signing preflight must run on a Windows runner.');
  });

  test('sets up the module once and signs with bounded noninteractive PowerShell calls', async () => {
    const { calls, spawn } = createSuccessfulSpawn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await windowsSign({ path: "C:/dist/Yosemite Crew's PIMS.exe" }, undefined, {
      env: createValidEnv(),
      platform: 'win32',
      spawn,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].command).toBe('pwsh');
    expect(calls[0].args).toEqual(
      expect.arrayContaining(['-NoLogo', '-NoProfile', '-NonInteractive'])
    );
    expect(calls[0].args.join('\n')).toContain('Install-Module -Name TrustedSigning');
    expect(calls[1].args.join('\n')).toContain('Invoke-TrustedSigning @params');
    expect(calls[1].args.join('\n')).toContain("Files = 'C:/dist/Yosemite Crew''s PIMS.exe'");
    expect(log).toHaveBeenCalledWith(
      "[windows-sign] Signing Yosemite Crew's PIMS.exe with Azure Trusted Signing."
    );
  });
});
