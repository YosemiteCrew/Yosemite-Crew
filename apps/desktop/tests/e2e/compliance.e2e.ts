import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';

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
  const pages = await openPimsTab(app, pimsOrigin);
  return { app, page: pages.shell, tab: pages.tab, userDataDir: profileDir };
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
  let tab: Page;
  let pimsServer: TestServer;
  let userDataDir: string | undefined;

  test.beforeEach(async () => {
    pimsServer = await startPimsServer();
    const launched = await launchApp(pimsServer.origin);
    app = launched.app;
    page = launched.page;
    tab = launched.tab;
    userDataDir = launched.userDataDir;
  });

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    await pimsServer?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    app = undefined;
    userDataDir = undefined;
  });

  // Four tests were removed here, deliberately, when this suite was first run in
  // CI. They drove registerDeaNumber/getDeaNumber, verifyAuditTrail and
  // createBackup over IPC, and none of those channels exists any more: the only
  // DEA channel is yc:dea-register, and there is no audit-verification or backup
  // channel at all.
  //
  // The capabilities themselves are alive and well in the main process -
  // src/utils/backup.ts, src/compliance/audit-log.ts and
  // src/compliance/dea-registration.ts - they simply stopped being reachable from
  // a renderer. That is the right call for privileged compliance operations, and
  // it is enforced by the sender-frame check in core/ipc.ts. These are menu and
  // main-process driven now.
  //
  // So the coverage did not disappear with the tests; it lives at the level that
  // can actually reach the code: tests/backup.test.ts, tests/audit-log.test.ts,
  // tests/offline-audit-trail.test.ts and tests/dea-registration.test.ts. Keeping
  // e2e tests that call removed IPC would only have asserted that a null is a
  // null.
  //
  // What remains below is the part that is still genuinely end-to-end: a
  // controlled-substance record written through IPC and read back out as CSV.

  test('CS record via IPC export CSV with correct headers', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const addResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'csRecord', {
      medication: 'Test Substance',
      quantity: 10,
      patientId: 'E2E-PATIENT',
    });
    expect(addResult.ok).toBe(true);
    const csvResult = await evaluateYcDesktop<{ ok: boolean; data: string }>(page, 'csExport');
    expect(csvResult.ok).toBe(true);
    expect(csvResult.data).toContain('medication');
    expect(csvResult.data).toContain('quantity');
    expect(csvResult.data).toContain('Test Substance');
    expect(csvResult.data).toContain('10');
  });
});
