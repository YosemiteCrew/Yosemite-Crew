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

const startPimsServer = async (docOrigin: string): Promise<TestServer> =>
  startServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    res.setHeader('content-type', 'text/html; charset=utf-8');

    if (url.pathname === '/signin') {
      res.end(
        html(
          'Sign In',
          `<h1>Sign In</h1>
           <button id="external" onclick="window.open('https://example.com/phish')">External</button>
           <button id="developer" onclick="window.open('/developers/home')">Developer</button>
           <button id="document" onclick="window.open('${docOrigin}/document')">Document</button>`
        )
      );
      return;
    }

    if (url.pathname === '/appointments/123') {
      res.end(html('Appointment 123', '<h1>Appointment 123</h1>'));
      return;
    }

    if (url.pathname === '/developers/home') {
      res.end(html('Developer Portal', '<h1>Developer Portal</h1>'));
      return;
    }

    res.statusCode = 404;
    res.end(html('Not Found', '<h1>Not Found</h1>'));
  });

const startDocumentServer = async (): Promise<TestServer> =>
  startServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html('Document Preview', '<h1>Document Preview</h1>'));
  });

const launchPackagedApp = async (pimsOrigin: string, docOrigin: string, userDataDir?: string) => {
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-desktop-e2e-'));
  const app = await electron.launch({
    executablePath: ELECTRON_EXECUTABLE,
    args: [APP_ROOT],
    env: {
      ...process.env,
      YC_DESKTOP_START_URL: `${pimsOrigin}/signin`,
      YC_DESKTOP_ALLOWED_ORIGINS: pimsOrigin,
      YC_DESKTOP_IN_APP_POPUP_ORIGINS: docOrigin,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: profileDir,
    },
  });

  await app.evaluate(({ shell }) => {
    const state = globalThis as unknown as { __ycOpenedExternal: string[] };
    state.__ycOpenedExternal = [];
    shell.openExternal = async (url: string) => {
      state.__ycOpenedExternal.push(String(url));
    };
  });

  return { app, page: await app.firstWindow(), userDataDir: profileDir };
};

test.describe('packaged Yosemite Crew PIMS desktop app', () => {
  let app: ElectronApplication | undefined;
  let page: Page;
  let pimsServer: TestServer;
  let docServer: TestServer;
  let userDataDir: string | undefined;

  test.beforeEach(async () => {
    docServer = await startDocumentServer();
    pimsServer = await startPimsServer(docServer.origin);
    const launched = await launchPackagedApp(pimsServer.origin, docServer.origin);
    app = launched.app;
    page = launched.page;
    userDataDir = launched.userDataDir;
  });

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    await pimsServer?.close().catch(() => undefined);
    await docServer?.close().catch(() => undefined);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    app = undefined;
    userDataDir = undefined;
  });

  test('renders the welcome screen and Sign in loads /signin', async () => {
    await expect(page.getByRole('heading', { name: /yosemite crew pims/i })).toBeVisible();
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(`${pimsServer.origin}/signin`);
    await expect(page).toHaveTitle(/Sign In/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('renders offline page when the sign-in page cannot load', async () => {
    await pimsServer.close();
    await app?.evaluate(async ({ BrowserWindow }, signinUrl) => {
      await BrowserWindow.getAllWindows()[0]?.loadURL(signinUrl);
    }, `${pimsServer.origin}/signin`);

    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('routes yosemitecrew deep links to the matching PIMS page', async () => {
    await page.getByRole('button', { name: /sign in/i }).click();
    await app?.evaluate(({ app: electronApp }, deepLink) => {
      electronApp.emit('open-url', { preventDefault() {} }, deepLink);
    }, 'yosemitecrew://appointments/123');

    await expect(page).toHaveURL(`${pimsServer.origin}/appointments/123`);
    await expect(page.getByRole('heading', { name: 'Appointment 123' })).toBeVisible();
  });

  test('persists window state across relaunches', async () => {
    const profileDir = userDataDir as string;

    await app?.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setBounds({ x: 42, y: 48, width: 1180, height: 820 });
      win?.emit('close');
    });
    await app?.close();
    app = undefined;

    const relaunched = await launchPackagedApp(pimsServer.origin, docServer.origin, profileDir);
    app = relaunched.app;
    page = relaunched.page;
    userDataDir = relaunched.userDataDir;

    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getBounds()
    );
    expect(bounds?.width).toBe(1180);
    expect(bounds?.height).toBe(820);
  });
});
