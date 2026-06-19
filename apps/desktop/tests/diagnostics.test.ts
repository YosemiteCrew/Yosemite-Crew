import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  collectDiagnosticData,
  readRecentLogEntries,
  createDiagnosticBundle,
  writeDiagnosticZip,
  type BundleContext,
  type DiagnosticData,
} from '../src/utils/diagnostics';
import { getDesktopConfig } from '../src/core/navigation-policy';

const MOCK_FUSES: Record<string, boolean> = {
  RunAsNode: false,
  EnableCookieEncryption: true,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
  LoadBrowserProcessSpecificV8Snapshot: false,
  GrantFileProtocolExtraPrivileges: true,
};

const BASE_CTX: BundleContext = {
  appVersion: '0.1.0',
  electronVersion: '39.8.10',
  chromeVersion: '134.0.0',
  nodeVersion: '20.18.0',
  v8Version: '13.4.0',
  platform: 'darwin',
  arch: 'arm64',
  osRelease: '24.3.0',
  isPackaged: true,
  config: getDesktopConfig({}),
  fuses: MOCK_FUSES,
};

describe('collectDiagnosticData', () => {
  test('includes all required sections', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data).toHaveProperty('generatedAt');
    expect(data).toHaveProperty('app');
    expect(data).toHaveProperty('system');
    expect(data).toHaveProperty('runtime');
    expect(data).toHaveProperty('config');
    expect(data).toHaveProperty('fuses');
    expect(data).toHaveProperty('recentLogLines');
  });

  test('captures app identity', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.app.name).toBe('Yosemite Crew PIMS');
    expect(data.app.version).toBe('0.1.0');
    expect(data.app.isPackaged).toBe(true);
  });

  test('captures system info', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.system.platform).toBe('darwin');
    expect(data.system.arch).toBe('arm64');
    expect(data.system.release).toBe('24.3.0');
  });

  test('captures runtime versions', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.runtime.electron).toBe('39.8.10');
    expect(data.runtime.chrome).toBe('134.0.0');
    expect(data.runtime.node).toBe('20.18.0');
    expect(data.runtime.v8).toBe('13.4.0');
  });

  test('omits v8 when not provided', () => {
    const ctx = { ...BASE_CTX, v8Version: undefined };
    const data = collectDiagnosticData(ctx);
    expect(data.runtime.v8).toBeUndefined();
  });

  test('captures config fields', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.config.startUrl).toBe('https://www.yosemitecrew.com/signin');
    expect(data.config.allowedOrigins).toContain('https://yosemitecrew.com');
    expect(data.config.appPartition).toBe('persist:yosemitecrew-pims');
  });

  test('captures fuses', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.fuses.EnableCookieEncryption).toBe(true);
    expect(data.fuses.RunAsNode).toBe(false);
  });

  test('generatedAt is a valid ISO timestamp', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(() => new Date(data.generatedAt)).not.toThrow();
    expect(Date.parse(data.generatedAt)).not.toBeNaN();
  });

  test('config allowedOrigins is a frozen snapshot, not a live reference', () => {
    const data = collectDiagnosticData(BASE_CTX);
    const originalLength = data.config.allowedOrigins.length;
    BASE_CTX.config.allowedOrigins.add('https://extra.example.com');
    expect(data.config.allowedOrigins).toHaveLength(originalLength);
  });

  test('recentLogLines starts at 0', () => {
    const data = collectDiagnosticData(BASE_CTX);
    expect(data.recentLogLines).toBe(0);
  });
});

describe('readRecentLogEntries', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when path is undefined', () => {
    expect(readRecentLogEntries(undefined)).toEqual([]);
  });

  test('returns empty array when file does not exist', () => {
    expect(readRecentLogEntries('/nonexistent/path.log')).toEqual([]);
  });

  test('reads all lines from a small file', () => {
    const logPath = path.join(tmpDir, 'small.log');
    fs.writeFileSync(logPath, 'line1\nline2\nline3\n', 'utf8');
    const entries = readRecentLogEntries(logPath, 100);
    expect(entries).toEqual(['line1', 'line2', 'line3']);
  });

  test('returns only the most recent lines when exceeding maxLines', () => {
    const logPath = path.join(tmpDir, 'large.log');
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
    fs.writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');
    const entries = readRecentLogEntries(logPath, 10);
    expect(entries).toHaveLength(10);
    expect(entries[0]).toBe('line91');
    expect(entries[9]).toBe('line100');
  });

  test('returns empty array on read error', () => {
    const logPath = path.join(tmpDir, 'missing.log');
    expect(readRecentLogEntries(logPath)).toEqual([]);
  });
});

describe('createDiagnosticBundle', () => {
  test('produces JSON and log content strings', () => {
    const data: DiagnosticData = collectDiagnosticData(BASE_CTX);
    const bundle = createDiagnosticBundle(data, ['warn: something', 'info: ok']);
    expect(typeof bundle.diagnosticsJson).toBe('string');
    expect(typeof bundle.logContent).toBe('string');
    const parsed = JSON.parse(bundle.diagnosticsJson);
    expect(parsed.recentLogLines).toBe(2);
  });

  test('produces empty log content when no entries', () => {
    const data: DiagnosticData = collectDiagnosticData(BASE_CTX);
    const bundle = createDiagnosticBundle(data, []);
    expect(bundle.logContent).toBe('');
    expect(bundle.diagnosticsJson).toContain('"recentLogLines": 0');
  });

  test('diagnostics JSON is valid and complete', () => {
    const data: DiagnosticData = collectDiagnosticData(BASE_CTX);
    const bundle = createDiagnosticBundle(data, ['log1']);
    const parsed = JSON.parse(bundle.diagnosticsJson);
    expect(parsed.generatedAt).toBe(data.generatedAt);
    expect(parsed.recentLogLines).toBe(1);
    expect(parsed.app.version).toBe('0.1.0');
  });
});

describe('writeDiagnosticZip', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-zip-test-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates a valid zip file with diagnostics content', async () => {
    const destPath = path.join(tmpDir, 'test-bundle.zip');
    const bundle = createDiagnosticBundle(collectDiagnosticData(BASE_CTX), [
      'log entry 1',
      'log entry 2',
    ]);
    const result = await writeDiagnosticZip(destPath, bundle.diagnosticsJson, bundle.logContent);
    expect(result).toBe(destPath);
    expect(fs.existsSync(destPath)).toBe(true);
    const stat = fs.statSync(destPath);
    expect(stat.size).toBeGreaterThan(50);
  });

  test('creates valid zip even without log entries', async () => {
    const destPath = path.join(tmpDir, 'no-log-bundle.zip');
    const bundle = createDiagnosticBundle(collectDiagnosticData(BASE_CTX), []);
    const result = await writeDiagnosticZip(destPath, bundle.diagnosticsJson, '');
    expect(result).toBe(destPath);
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(20);
  });
});
