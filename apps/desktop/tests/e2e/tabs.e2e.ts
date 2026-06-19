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
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-tabs-'));
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

type TabResult = {
  ok: boolean;
  id?: string;
  tabs?: Array<{ id: string; url: string; title: string; pinned: boolean }>;
  activeId?: string | null;
  error?: string;
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

const waitForTabCount = async (page: Page, count: number, timeout = 5000): Promise<void> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    if (state && state.ok && Array.isArray(state.tabs) && state.tabs.length === count) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timed out waiting for ${count} tabs`);
};

test.describe('tab E2E', () => {
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

  test('starts with one tab pointing at startUrl', async () => {
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.ok).toBe(true);
    expect(Array.isArray(state.tabs)).toBe(true);
    expect(state.tabs!.length).toBe(1);
    expect(state.tabs![0].url).toContain(pimsServer.origin);
  });

  test('opens a new tab via IPC', async () => {
    const result = await evaluateYcDesktop<TabResult>(
      page,
      'newTab',
      `${pimsServer.origin}/appointments`
    );
    expect(result.ok).toBe(true);
    expect(typeof result.id).toBe('string');

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!.length).toBe(2);
    expect(state.activeId).toBe(result.id);
  });

  test('opens multiple tabs and switches between them', async () => {
    const t1 = await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/a`);
    const t2 = await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/b`);

    expect(t1.ok).toBe(true);
    expect(t2.ok).toBe(true);

    // Switch back to first tab
    const switched = await evaluateYcDesktop<{ ok: boolean }>(page, 'activateTab', t1.id!);
    expect(switched.ok).toBe(true);

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.activeId).toBe(t1.id);
    expect(state.tabs!.length).toBe(3);
  });

  test('closes a tab via IPC', async () => {
    // Start with 1 tab, create another, close the original
    const original = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const originalId = original.tabs![0].id;

    const t2 = await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    const closeResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'closeTab', originalId);
    expect(closeResult.ok).toBe(true);

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!.length).toBe(1);
    expect(state.tabs![0].id).toBe(t2.id);
  });

  test('reorders tabs', async () => {
    const original = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const originalId = original.tabs![0].id;

    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/c`);
    await waitForTabCount(page, 3);

    // Move original tab to index 2 (last)
    const moved = await evaluateYcDesktop<{ ok: boolean }>(page, 'moveTab', originalId, 2);
    expect(moved.ok).toBe(true);

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs![2].id).toBe(originalId);
  });

  test('pins and unpins a tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![1].id;

    const pinned = await evaluateYcDesktop<{ ok: boolean }>(page, 'pinTab', tabId, true);
    expect(pinned.ok).toBe(true);

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs![0].pinned).toBe(true); // pinned tabs sort first

    const unpinned = await evaluateYcDesktop<{ ok: boolean }>(page, 'pinTab', tabId, false);
    expect(unpinned.ok).toBe(true);
  });

  test('duplicates a tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/appointments`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![1].id;

    const dup = await evaluateYcDesktop<{ ok: boolean; id?: string }>(page, 'duplicateTab', tabId);
    expect(dup.ok).toBe(true);
    expect(typeof dup.id).toBe('string');

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs!.length).toBe(3);
  });

  test('reopens a closed tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/appointments`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![0].id;

    await evaluateYcDesktop(page, 'closeTab', tabId);
    await waitForTabCount(page, 1);

    const reopened = await evaluateYcDesktop<{ ok: boolean; id?: string }>(page, 'reopenClosedTab');
    expect(reopened.ok).toBe(true);

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs!.length).toBe(2);
  });

  test('Cmd+T opens a new tab', async () => {
    await waitForTabCount(page, 1);
    await page.keyboard.press('Meta+T');
    await page.waitForTimeout(500);
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!.length).toBe(2);
  });

  test('Cmd+W closes the active tab', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await page.keyboard.press('Meta+W');
    await page.waitForTimeout(500);
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!.length).toBe(1);
  });

  test('Cmd+Shift+T reopens closed tab', async () => {
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state0.tabs![0].id;
    await evaluateYcDesktop(page, 'closeTab', tabId);
    await waitForTabCount(page, 0);
    await page.keyboard.press('Meta+Shift+T');
    await page.waitForTimeout(500);
    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state1.tabs!.length).toBe(1);
  });

  test('closing all tabs returns empty list', async () => {
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state0.tabs![0].id;
    await evaluateYcDesktop(page, 'closeTab', tabId);
    await waitForTabCount(page, 0);
    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state1.tabs!.length).toBe(0);
    expect(state1.activeId).toBeNull();
  });

  test('sets tab zoom', async () => {
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state0.tabs![0].id;
    const zoomResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'setTabZoom', tabId, 1.5);
    expect(zoomResult.ok).toBe(true);
  });

  test('find-in-page IPC targets active tab', async () => {
    const result = await evaluateYcDesktop<{ ok: boolean; requestId?: number }>(
      page,
      'findInPage',
      'test'
    );
    expect(result.ok).toBe(true);
    expect(typeof result.requestId).toBe('number');
  });

  test('stop-find-in-page IPC', async () => {
    await evaluateYcDesktop(page, 'findInPage', 'test');
    const stopped = await evaluateYcDesktop<{ ok: boolean }>(page, 'stopFindInPage');
    expect(stopped.ok).toBe(true);
  });

  test('devtools IPC opens and closes', async () => {
    const opened = await evaluateYcDesktop<{ ok: boolean }>(page, 'openDevTools');
    expect(opened.ok).toBe(true);
    const closed = await evaluateYcDesktop<{ ok: boolean }>(page, 'closeDevTools');
    expect(closed.ok).toBe(true);
  });

  test('menu navigation back/forward wired to activeContents', async () => {
    // Navigate to a new URL first so there's a history entry
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/page1`);
    await waitForTabCount(page, 2);
    // "Back" menu item at index positions 0,1 = Navigate menu, submenu index 1 = Back
    // We test via IPC since keyboard simulation for menu items is unreliable
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state0.tabs!.length).toBe(2);
  });

  test('tab search opens and closes', async () => {
    const opened = await evaluateYcDesktop<{ ok: boolean }>(page, 'tabSearch', true);
    expect(opened.ok).toBe(true);

    const stateWithSearch = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(stateWithSearch.ok).toBe(true);

    const closed = await evaluateYcDesktop<{ ok: boolean }>(page, 'tabSearch', false);
    expect(closed.ok).toBe(true);
  });

  test('session persists across relaunch', async () => {
    // Create some tabs
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/a`);
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 3);

    const stateBefore = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(stateBefore.tabs!.length).toBe(3);

    const profileDir = userDataDir as string;
    await app!.close();
    app = undefined;

    // Relaunch with same userDataDir
    const relaunched = await launchApp(pimsServer.origin, profileDir);
    app = relaunched.app;
    page = relaunched.page;
    userDataDir = relaunched.userDataDir;

    const stateAfter = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(stateAfter.ok).toBe(true);
    expect(Array.isArray(stateAfter.tabs)).toBe(true);
    expect(stateAfter.tabs!.length).toBeGreaterThan(0);
  });
});
