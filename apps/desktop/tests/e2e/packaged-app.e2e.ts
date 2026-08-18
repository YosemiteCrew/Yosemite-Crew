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

  const pages = await openPimsTab(app, pimsOrigin);
  return { app, page: pages.shell, tab: pages.tab, userDataDir: profileDir };
};

test.describe('packaged Yosemite Crew PIMS desktop app', () => {
  let app: ElectronApplication | undefined;
  let tab: Page;
  let pimsServer: TestServer;
  let docServer: TestServer;
  let userDataDir: string | undefined;

  test.beforeEach(async () => {
    docServer = await startDocumentServer();
    pimsServer = await startPimsServer(docServer.origin);
    const launched = await launchPackagedApp(pimsServer.origin, docServer.origin);
    app = launched.app;
    tab = launched.tab;
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

  // The welcome screen's Sign in button is what openPimsTab clicks during
  // launch, so this asserts the end state of that transition rather than
  // performing it a second time against a screen the app has already left.
  test('Sign in from the welcome screen loads /signin in a tab', async () => {
    await expect(tab).toHaveURL(`${pimsServer.origin}/signin`);
    await expect(tab).toHaveTitle(/Sign In/);
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('renders offline page when the sign-in page cannot load', async () => {
    await pimsServer.close();
    // Navigating the TAB, not the shell window. The app is in tab mode by now,
    // so PIMS content - and the offline page that replaces it - lives in the
    // tab; loading into the shell would replace the tab chrome instead. The
    // rejection is expected: the server was just closed, which is the condition
    // under test.
    await tab.goto(`${pimsServer.origin}/signin`).catch(() => undefined);

    await expect(tab.getByRole('heading', { name: "You're offline" })).toBeVisible();
    await expect(tab.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('routes yosemitecrew deep links to the matching PIMS page', async () => {
    // No sign-in click: openPimsTab already left the welcome screen during
    // launch. The deep link resolves into the TAB, so both assertions belong
    // there - `page` is the shell and stays on welcome.html, which is what the
    // URL assertion was actually reporting.
    await app?.evaluate(({ app: electronApp }, deepLink) => {
      electronApp.emit('open-url', { preventDefault() {} }, deepLink);
    }, 'yosemitecrew://appointments/123');

    await expect(tab).toHaveURL(`${pimsServer.origin}/appointments/123`);
    await expect(tab.getByRole('heading', { name: 'Appointment 123' })).toBeVisible();
  });

  test('persists window state across relaunches', async () => {
    const profileDir = userDataDir as string;

    // setBounds is applied by the window server asynchronously, so emitting
    // 'close' in the same tick made the app's handler read - and persist - the
    // OLD bounds. CI then restored 1024 and the assertion blamed persistence for
    // what was really a race in the test. Wait for the resize to land first.
    await app?.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) throw new Error('no window to resize');
      win.setBounds({ x: 42, y: 48, width: 1180, height: 820 });

      const deadline = Date.now() + 5000;
      while (win.getBounds().width !== 1180 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (win.getBounds().width !== 1180) {
        throw new Error(`window never resized: width is ${win.getBounds().width}`);
      }

      // Let the resize handler's own debounced persist run (400ms in
      // window-state.ts) rather than emitting a synthetic 'close'. The synthetic
      // event fired the save, but on CI the state still came back as defaults,
      // and driving the real code path removes the guesswork about what else
      // that emit set in motion during shutdown.
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    await app?.close();
    app = undefined;

    const relaunched = await launchPackagedApp(pimsServer.origin, docServer.origin, profileDir);
    app = relaunched.app;
    userDataDir = relaunched.userDataDir;

    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getBounds()
    );
    expect(bounds?.width).toBe(1180);
    expect(bounds?.height).toBe(820);
  });
});
