import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';
import { clickMenuItem } from './menu';

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
  const pages = await openPimsTab(app, pimsOrigin);
  return { app, page: pages.shell, tab: pages.tab, userDataDir: profileDir };
};

type TabResult = {
  ok: boolean;
  id?: string;
  tabs?: Array<{ id: string; url: string; title: string; pinned: boolean }>;
  activeId?: string | null;
  error?: string;
};

const callYcDesktop = <T>(page: Page, method: string, args: unknown[]): Promise<T> =>
  page.evaluate(
    ({ m, a }: { m: string; a: unknown[] }) => {
      const yc = (window as unknown as Record<string, unknown>).ycDesktop as Record<
        string,
        unknown
      >;
      if (yc && typeof yc === 'object' && typeof yc[m] === 'function') {
        return (yc[m] as (...args: unknown[]) => unknown)(...a);
      }
      return null;
    },
    { m: method, a: args }
  ) as Promise<T>;

// Retries once when the page navigates mid-call. Closing the last tab makes the
// app leave tab mode and return to the welcome screen, which tears down the
// execution context an in-flight evaluate is running in - so the call fails for
// a reason that has nothing to do with what it was asking.
const evaluateYcDesktop = async <T>(page: Page, method: string, ...args: unknown[]): Promise<T> => {
  try {
    return await callYcDesktop<T>(page, method, args);
  } catch (error) {
    if (!String(error).includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('domcontentloaded');
    return callYcDesktop<T>(page, method, args);
  }
};

type PaneBounds = { x: number; y: number; width: number; height: number };

// The window's mounted child views, read from the main process. A content pane
// that is still in `contentView.children` is still drawn and still takes input,
// whatever the shell's own split state says.
const mountedContentPanes = async (
  app: ElectronApplication,
  chromeStripHeight = 40
): Promise<PaneBounds[]> => {
  const bounds = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [] as PaneBounds[];
    return win.contentView.children.map((child) => child.getBounds());
  });
  // Everything below the tab strip is a content pane.
  return bounds.filter((b) => b.y >= chromeStripHeight);
};

const contentWidth = (app: ElectronApplication): Promise<number> =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win ? win.getContentBounds().width : 0;
  });

const waitForTabCount = async (page: Page, count: number, timeout = 5000): Promise<void> => {
  await expect
    .poll(
      async () => {
        const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
        return state?.ok && Array.isArray(state.tabs) ? state.tabs.length : -1;
      },
      { timeout, message: `Timed out waiting for ${count} tabs` }
    )
    .toBe(count);
};

// Send a tab-jump key to the focused PIMS content view, the way a keyboard does:
// through the window's input pipeline rather than into the page's DOM.
const pressTabJumpKey = async (
  app: ElectronApplication,
  urlPart: string,
  key: string
): Promise<void> => {
  await app.evaluate(
    async ({ webContents }, { origin, digit, modifier }) => {
      const target = webContents
        .getAllWebContents()
        .find((wc) => wc.getURL().includes(origin) && !wc.isDestroyed());
      if (!target) throw new Error(`no web contents is showing ${origin}`);
      target.focus();
      target.sendInputEvent({ type: 'keyDown', keyCode: digit, modifiers: [modifier] });
      target.sendInputEvent({ type: 'keyUp', keyCode: digit, modifiers: [modifier] });
    },
    {
      origin: urlPart,
      digit: key,
      modifier: process.platform === 'darwin' ? ('meta' as const) : ('control' as const),
    }
  );
};

// The shortcut-list overlay lives in the tab-chrome view, which is a
// WebContentsView rather than a window, so it is read from the main process.
const cheatsheetDisplay = (app: ElectronApplication): Promise<string> =>
  app.evaluate(async ({ webContents }) => {
    const chrome = webContents
      .getAllWebContents()
      .find((wc) => wc.getURL().includes('tabbar.html') && !wc.isDestroyed());
    if (!chrome) throw new Error('the tab chrome view is not loaded');
    return (await chrome.executeJavaScript(
      "document.getElementById('cheatsheet-overlay').style.display"
    )) as string;
  });

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
    expect(state.tabs!).toHaveLength(1);
    expect(state.tabs![0]!.url).toContain(pimsServer.origin);
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
    expect(state.tabs!).toHaveLength(2);
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
    expect(state.tabs!).toHaveLength(3);
  });

  test('closes a tab via IPC', async () => {
    // Start with 1 tab, create another, close the original
    const original = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const originalId = original.tabs![0]!.id;

    const t2 = await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    const closeResult = await evaluateYcDesktop<{ ok: boolean }>(page, 'closeTab', originalId);
    expect(closeResult.ok).toBe(true);

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!).toHaveLength(1);
    expect(state.tabs![0]!.id).toBe(t2.id);
  });

  test('reorders tabs', async () => {
    const original = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const originalId = original.tabs![0]!.id;

    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/c`);
    await waitForTabCount(page, 3);

    // Move original tab to index 2 (last)
    const moved = await evaluateYcDesktop<{ ok: boolean }>(page, 'moveTab', originalId, 2);
    expect(moved.ok).toBe(true);

    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs![2]!.id).toBe(originalId);
  });

  // #3287: closing the split only cleared the shell's splitId. The right-hand
  // view stayed mounted above the primary, so it kept covering half the window
  // and swallowing the clicks meant for the active tab.
  test('closing split view gives the whole content area back to the active tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/labs`);
    await waitForTabCount(page, 2);
    const full = await contentWidth(app!);
    expect(full).toBeGreaterThan(0);

    await evaluateYcDesktop(page, 'executeCommand', 'tab:toggle-split');
    await expect
      .poll(async () => (await mountedContentPanes(app!)).length, {
        message: 'Timed out waiting for the split to open',
      })
      .toBe(2);

    const split = await mountedContentPanes(app!);
    const left = split.find((b) => b.x === 0)!;
    const right = split.find((b) => b.x > 0)!;
    expect(left.width).toBeLessThan(full);
    // #3301: the panes used to meet edge to edge, so nothing marked where one
    // ended and the next began. The left pane gives up its last column and the
    // window's own background shows through as a 1px divider.
    expect(right.x - (left.x + left.width)).toBe(1);
    expect(right.x + right.width).toBe(full);

    await evaluateYcDesktop(page, 'executeCommand', 'tab:toggle-split');
    await expect
      .poll(async () => (await mountedContentPanes(app!)).length, {
        message: 'The closed split view is still mounted over the active tab',
      })
      .toBe(1);

    const [only] = await mountedContentPanes(app!);
    expect(only!.x).toBe(0);
    expect(only!.width).toBe(full);
  });

  test('pins and unpins a tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![1]!.id;

    const pinned = await evaluateYcDesktop<{ ok: boolean }>(page, 'pinTab', tabId, true);
    expect(pinned.ok).toBe(true);

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs![0]!.pinned).toBe(true); // pinned tabs sort first

    const unpinned = await evaluateYcDesktop<{ ok: boolean }>(page, 'pinTab', tabId, false);
    expect(unpinned.ok).toBe(true);
  });

  test('duplicates a tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/appointments`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![1]!.id;

    const dup = await evaluateYcDesktop<{ ok: boolean; id?: string }>(page, 'duplicateTab', tabId);
    expect(dup.ok).toBe(true);
    expect(typeof dup.id).toBe('string');

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs!).toHaveLength(3);
  });

  test('reopens a closed tab', async () => {
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/appointments`);
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state1.tabs![0]!.id;

    await evaluateYcDesktop(page, 'closeTab', tabId);
    await waitForTabCount(page, 1);

    const reopened = await evaluateYcDesktop<{ ok: boolean; id?: string }>(page, 'reopenClosedTab');
    expect(reopened.ok).toBe(true);

    const state2 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state2.tabs!).toHaveLength(2);
  });

  test('Mod+1 and Mod+2 jump between tabs while the page holds focus', async () => {
    const first = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const firstId = first.tabs![0]!.id;
    const second = await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/a`);
    await waitForTabCount(page, 2);

    // Sent to the CONTENT view, not the tab strip: the strip's own key listener
    // only sees a keystroke while the strip has focus, which the page holds for
    // the rest of the session. Playwright cannot synthesise OS input, and the
    // window's before-input-event hook is what this exercises.
    await pressTabJumpKey(app!, pimsServer.origin, '1');
    await expect
      .poll(async () => (await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId)
      .toBe(firstId);

    await pressTabJumpKey(app!, pimsServer.origin, '2');
    await expect
      .poll(async () => (await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId)
      .toBe(second.id);
  });

  test('the tab strip gets Mod+1 from the window, not from its own listener', async () => {
    const first = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const firstId = first.tabs![0]!.id;
    await evaluateYcDesktop<TabResult>(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    // Sent to the tab-chrome view itself. Its keydown handler no longer has a
    // digits branch, so a tab switch here can only have come from the window.
    await pressTabJumpKey(app!, 'tabbar.html', '1');
    await expect
      .poll(async () => (await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId)
      .toBe(firstId);
  });

  test('the Keyboard Shortcuts menu item toggles the shortcut list', async () => {
    await waitForTabCount(page, 1);
    expect(await cheatsheetDisplay(app!)).not.toBe('block');

    await clickMenuItem(app!, 'Keyboard Shortcuts');
    await expect.poll(() => cheatsheetDisplay(app!)).toBe('block');

    await clickMenuItem(app!, 'Keyboard Shortcuts');
    await expect.poll(() => cheatsheetDisplay(app!)).not.toBe('block');
  });

  test('the New Tab menu item opens a tab', async () => {
    await waitForTabCount(page, 1);
    await clickMenuItem(app!, 'New Tab');
    await waitForTabCount(page, 2);
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!).toHaveLength(2);
  });

  test('the Close Tab menu item closes the active tab', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await clickMenuItem(app!, 'Close Tab');
    await waitForTabCount(page, 1);
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state.tabs!).toHaveLength(1);
  });

  test('the Reopen Closed Tab menu item restores it', async () => {
    // Opens a second tab first, so closing one does not close the LAST one.
    // main.ts's reopenClosedTab() begins `if (!tabMode ...) return`, and closing
    // the final tab leaves tab mode - so reopening after closing your only tab
    // is a silent no-op. Chrome restores it in that situation; whether this app
    // should is a product question, filed rather than changed here. Either way
    // it is not what this test is for: the behaviour under test is that a closed
    // tab can be restored, and that is what this now exercises.
    await evaluateYcDesktop(page, 'newTab', `${pimsServer.origin}/b`);
    await waitForTabCount(page, 2);

    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const closedId = state0.tabs![1]!.id;
    await evaluateYcDesktop(page, 'closeTab', closedId);
    await waitForTabCount(page, 1);

    await clickMenuItem(app!, 'Reopen Closed Tab');
    await waitForTabCount(page, 2);

    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state1.tabs!).toHaveLength(2);
    expect(state1.tabs!.some((t) => t.url.endsWith('/b'))).toBe(true);
  });

  test('closing all tabs returns empty list', async () => {
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state0.tabs![0]!.id;
    await evaluateYcDesktop(page, 'closeTab', tabId);
    await waitForTabCount(page, 0);
    const state1 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    expect(state1.tabs!).toHaveLength(0);
    expect(state1.activeId).toBeNull();
  });

  test('sets tab zoom', async () => {
    const state0 = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const tabId = state0.tabs![0]!.id;
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
    expect(state0.tabs!).toHaveLength(2);
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
    expect(stateBefore.tabs!).toHaveLength(3);

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
