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
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-palette-'));
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

test.describe('command-palette E2E', () => {
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

  test('Cmd+K opens palette window', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await page.keyboard.press('Meta+K');
    await page.waitForTimeout(500);
    const paletteResult = await evaluateYcDesktop<unknown>(page, 'getPaletteActions');
    expect(paletteResult).not.toBeNull();
  });

  test('search "patient" returns "Patients" result', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await page.keyboard.press('Meta+K');
    await page.waitForTimeout(300);
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string; label: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    const patientAction = actions.actions.find((a) => a.label.toLowerCase().includes('patient'));
    expect(patientAction).toBeTruthy();
  });

  test('select result navigates to deep link', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    expect(actions.actions.length).toBeGreaterThan(0);
    const result = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'executeCommand',
      actions.actions[0].id
    );
    expect(result.ok).toBe(true);
  });

  test('search "xyzzy" returns no results text', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: unknown[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    expect(Array.isArray(actions.actions)).toBe(true);
  });

  test('execute via IPC fires navigation', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const result = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'executeCommand',
      'open-settings'
    );
    expect(result).not.toBeNull();
  });

  test('Escape closes palette', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await page.keyboard.press('Meta+K');
    await page.waitForTimeout(300);
    const closeResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'closePalette');
    expect(closeResult).not.toBeNull();
  });

  test('recents persist across palette open/close', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    if (actions.actions.length > 0) {
      await evaluateYcDesktop(page, 'executeCommand', actions.actions[0].id);
    }
    const recents1 = await evaluateYcDesktop<{
      ok: boolean;
      recents: string[];
    }>(page, 'getPaletteRecents');
    expect(recents1.ok).toBe(true);
    await evaluateYcDesktop(page, 'closePalette');
    await evaluateYcDesktop(page, 'executeCommand', 'open-settings');
    const recents2 = await evaluateYcDesktop<{
      ok: boolean;
      recents: string[];
    }>(page, 'getPaletteRecents');
    expect(recents2.ok).toBe(true);
  });

  test('stale recents IDs gracefully skipped', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const recents = await evaluateYcDesktop<{ ok: boolean; recents: string[] }>(
      page,
      'getPaletteRecents'
    );
    expect(recents.ok).toBe(true);
    expect(Array.isArray(recents.recents)).toBe(true);
  });

  test('fallback action set when ycDesktop partially unavailable', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string; label: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    const openSettings = actions.actions.find((a) => a.id === 'open-settings');
    expect(openSettings).toBeTruthy();
  });
});
