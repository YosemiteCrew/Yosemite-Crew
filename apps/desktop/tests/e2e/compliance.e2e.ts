import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

type TestServer = {
  origin: string;
  close: () => Promise<void>;
};

const APP_ROOT = path.resolve(__dirname, '..', '..');
const ELECTRON_EXECUTABLE = electronPath as unknown as string;

const startServer = async (
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<TestServer> => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind test server.');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
};

const html = (title: string, body: string) => `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>${title}</title></head>
  <body>${body}</body>
</html>`;

const startPimsServer = async (): Promise<TestServer> =>
  startServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (url.pathname === '/signin') {
      res.end(html('Sign In', '<h1>Sign In</h1>'));
      return;
    }
    res.end(html('PIMS', '<h1>PIMS App</h1>'));
  });

const launchApp = async (pimsOrigin: string, userDataDir?: string) => {
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-compliance-'));
  const app = await electron.launch({
    executablePath: ELECTRON_EXECUTABLE,
    args: [APP_ROOT],
    env: {
      ...process.env,
      YC_DESKTOP_START_URL: `${pimsOrigin}/signin`,
      YC_DESKTOP_ALLOWED_ORIGINS: pimsOrigin,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: profileDir,
    },
  });
  return { app, page: await app.firstWindow(), userDataDir: profileDir };
};

const evaluateYcDesktop = <T>(page: Page, method: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ({ m, a }: { m: string; a: unknown[] }) => {
      const yc = (window as Record<string, unknown>).ycDesktop as Record<string, unknown>;
      if (yc && typeof yc === 'object' && typeof yc[m] === 'function') {
        return (yc[m] as (...args: unknown[]) => unknown)(...a);
      }
      return null;
    },
    { m: method, a: args }
  );

test.describe('compliance E2E', () => {
  let app: ElectronApplication | undefined;
  let page: Page;
  let pimsServer: TestServer;
  let userDataDir: string | undefined;

  test.beforeEach(async () => {
    pimsServer = await startPimsServer();
    const launched = await launchApp(pimsServer.origin);
    app = launched.app;
    page = launched.page;
    userDataDir = launched.userDataDir;
  });

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    await pimsServer?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    app = undefined;
    userDataDir = undefined;
  });

  test('register DEA number persists across relaunch', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const registerResult = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'registerDeaNumber',
      'AB1234563'
    );
    expect(registerResult.ok).toBe(true);
    await app!.close();
    const relaunched = await launchApp(pimsServer.origin, userDataDir);
    app = relaunched.app;
    page = relaunched.page;
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const getResult = await evaluateYcDesktop<{
      ok: boolean;
      deaNumber: string | null;
    }>(page, 'getDeaNumber');
    expect(getResult.ok).toBe(true);
    expect(getResult.deaNumber).toBe('AB1234563');
  });

  test('append audit record and verify audit trail integrity', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const appendResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'appendAuditEntry', {
      action: 'test-action',
      details: 'E2E test entry',
    });
    expect(appendResult.ok).toBe(true);
    const verifyResult = await evaluateYcDesktop<{
      ok: boolean;
      valid: boolean;
    }>(page, 'verifyAuditTrail');
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.valid).toBe(true);
  });

  test('create backup zip in userData/backups/', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const backupResult = await evaluateYcDesktop<{
      ok: boolean;
      path?: string;
    }>(page, 'createBackup', {
      includeAuditLog: true,
      includeSettings: true,
    });
    expect(backupResult.ok).toBe(true);
    expect(backupResult.path).toBeTruthy();
    expect(fs.existsSync(backupResult.path!)).toBe(true);
    const stat = fs.statSync(backupResult.path!);
    expect(stat.size).toBeGreaterThan(0);
  });

  test('backup with encryption has non-plaintext body', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const backupResult = await evaluateYcDesktop<{
      ok: boolean;
      path?: string;
    }>(page, 'createBackup', {
      includeAuditLog: true,
      includeSettings: true,
      encrypt: true,
    });
    expect(backupResult.ok).toBe(true);
    expect(backupResult.path).toBeTruthy();
    const buf = fs.readFileSync(backupResult.path!);
    const strPreview = buf.toString('utf8').slice(0, 100);
    expect(strPreview).not.toContain('Settings');
    expect(strPreview).not.toContain('auditLog');
  });

  test('CS record via IPC export CSV with correct headers', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const addResult = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'addControlledSubstanceRecord',
      {
        medication: 'Test Substance',
        quantity: 10,
        patientId: 'E2E-PATIENT',
      }
    );
    expect(addResult.ok).toBe(true);
    const csvResult = await evaluateYcDesktop<{ ok: boolean; data: string }>(page, 'exportCsCsv');
    expect(csvResult.ok).toBe(true);
    expect(csvResult.data).toContain('medication');
    expect(csvResult.data).toContain('quantity');
    expect(csvResult.data).toContain('Test Substance');
    expect(csvResult.data).toContain('10');
  });
});
