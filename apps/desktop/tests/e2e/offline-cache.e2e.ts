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

const PAGES = [
  {
    path: '/appointments/1',
    title: 'Appt 1',
    body: '<h1>Appointment 1</h1><p>Patient: Fluffy</p>',
  },
  {
    path: '/appointments/2',
    title: 'Appt 2',
    body: '<h1>Appointment 2</h1><p>Patient: Whiskers</p>',
  },
  {
    path: '/patients/42',
    title: 'Patient 42',
    body: '<h1>Patient 42</h1><p>Name: Buddy</p>',
  },
];

const startPimsServer = async (): Promise<TestServer> =>
  startServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    res.setHeader('content-type', 'text/html; charset=utf-8');

    if (url.pathname === '/signin') {
      res.end(
        html(
          'Sign In',
          '<h1>Sign In</h1><button id="go-appt1" onclick="location.href=\'/appointments/1\'">Appt 1</button>'
        )
      );
      return;
    }

    const page = PAGES.find((p) => p.path === url.pathname);
    if (page) {
      res.end(html(page.title, page.body));
      return;
    }

    res.statusCode = 404;
    res.end(html('Not Found', '<h1>Not Found</h1>'));
  });

const launchApp = async (pimsOrigin: string, userDataDir?: string) => {
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-cache-'));
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

const navigateViaMain = async (app: ElectronApplication, url: string): Promise<void> => {
  await app.evaluate(async ({ BrowserWindow }, u) => {
    await BrowserWindow.getAllWindows()[0]?.loadURL(u);
  }, url);
};

test.describe('offline-cache E2E', () => {
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

  test('navigating to a page creates a cache file on disk', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /appt 1/i }).click();
    await expect(page.getByRole('heading', { name: 'Appointment 1' })).toBeVisible();

    const cacheFile = path.join(userDataDir as string, 'offline-cache-v1.json');
    expect(fs.existsSync(cacheFile)).toBe(true);
  });

  test('cached page loads from cache when server is down', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /appt 1/i }).click();
    await expect(page.getByRole('heading', { name: 'Appointment 1' })).toBeVisible();

    await pimsServer.close();
    await navigateViaMain(app!, `${pimsServer.origin}/appointments/1`);

    await expect(page.getByText('Appointment 1')).toBeVisible();
    await expect(page.getByText('Fluffy')).toBeVisible();
  });

  test('uncached URL shows offline page when server is down', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await pimsServer.close();
    await navigateViaMain(app!, `${pimsServer.origin}/patients/999`);

    await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
  });

  test('clearing cache empties the cache file', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /appt 1/i }).click();
    await expect(page.getByRole('heading', { name: 'Appointment 1' })).toBeVisible();

    await app?.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(
        'window.ycDesktop.clearCache()'
      );
    });

    await page.waitForTimeout(500);
    const cacheFile = path.join(userDataDir as string, 'offline-cache-v1.json');
    const content = fs.readFileSync(cacheFile, 'utf8');
    expect(JSON.parse(content)).toEqual([]);
  });

  test('multiple cached pages are listed via IPC', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();

    for (const p of PAGES) {
      await page.goto(`${pimsServer.origin}${p.path}`);
      await expect(page.getByRole('heading', { name: p.title })).toBeVisible();
    }

    const response: unknown = await page.evaluate(() =>
      (window as Record<string, unknown>).ycDesktop &&
      typeof (window as Record<string, unknown>).ycDesktop === 'object'
        ? ((window as Record<string, unknown>).ycDesktop as Record<string, unknown>).getCachedUrls
          ? (
              (window as Record<string, unknown>).ycDesktop as {
                getCachedUrls: () => Promise<unknown>;
              }
            ).getCachedUrls()
          : null
        : null
    );

    const result = response as { ok: boolean; urls: { url: string }[] };
    expect(result.ok).toBe(true);
    const urls = result.urls.map((u) => u.url);
    expect(urls).toHaveLength(PAGES.length);
    for (const p of PAGES) {
      expect(urls).toContain(`${pimsServer.origin}${p.path}`);
    }
  });

  test('cached content is accessible via IPC', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /appt 1/i }).click();
    await expect(page.getByRole('heading', { name: 'Appointment 1' })).toBeVisible();
    await page.waitForTimeout(500);

    const response: unknown = await page.evaluate(
      (url) =>
        (window as Record<string, unknown>).ycDesktop &&
        typeof (window as Record<string, unknown>).ycDesktop === 'object'
          ? (
              (window as Record<string, unknown>).ycDesktop as {
                getCachedContent: (u: string) => Promise<unknown>;
              }
            ).getCachedContent(url)
          : null,
      `${pimsServer.origin}/appointments/1`
    );

    const result = response as { ok: boolean; content?: string };
    expect(result.ok).toBe(true);
    expect(result.content).toBeTruthy();
    const decoded = Buffer.from(result.content!, 'base64').toString('utf8');
    expect(decoded).toContain('Appointment 1');
    expect(decoded).toContain('Fluffy');
  });
});
