import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';
import { clickMenuItem } from './menu';
import { recordFocusCalls, focusMark, focusedSince } from './focus-probe';

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
  await recordFocusCalls(app);
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

// The tab chrome is a WebContentsView rather than a window, so Playwright has
// no Page for it and everything in it is read through the main process.
const chromeEval = <T>(app: ElectronApplication, js: string): Promise<T> =>
  app.evaluate(async ({ webContents }, source) => {
    const chrome = webContents
      .getAllWebContents()
      .find((wc) => wc.getURL().includes('tabbar.html') && !wc.isDestroyed());
    if (!chrome) throw new Error('the tab chrome view is not loaded');
    return chrome.executeJavaScript(source);
  }, js) as Promise<T>;

// A key pressed at the tab chrome through the window's input pipeline, the way
// a keyboard delivers it - not a synthetic DOM event, which would skip focus.
const pressChromeKey = async (app: ElectronApplication, keyCode: string): Promise<void> => {
  await app.evaluate(({ webContents }, code) => {
    const chrome = webContents
      .getAllWebContents()
      .find((wc) => wc.getURL().includes('tabbar.html') && !wc.isDestroyed());
    if (!chrome) throw new Error('the tab chrome view is not loaded');
    chrome.focus();
    chrome.sendInputEvent({ type: 'keyDown', keyCode: code });
    chrome.sendInputEvent({ type: 'char', keyCode: code });
    chrome.sendInputEvent({ type: 'keyUp', keyCode: code });
  }, keyCode);
};

// The strip re-reads the tab state on a 1s poll, so the main process agreeing
// there are N tabs says nothing about what the strip has drawn. Any spec that
// changes the tab count must wait for the strip too, or it asserts against the
// previous render - which is how two of these passed on macOS and failed on
// Windows, where the poll lands later relative to the assertions.
const waitForStripTabs = async (app: ElectronApplication, count: number): Promise<void> => {
  await expect
    .poll(() => chromeEval<number>(app, "document.querySelectorAll('#tab-strip .tab').length"), {
      message: `the tab strip never drew ${count} tabs`,
    })
    .toBe(count);
};

const cheatsheetOpen = (app: ElectronApplication): Promise<boolean> =>
  chromeEval<boolean>(app, "document.getElementById('cheatsheet-dialog').open");

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
    expect(left.x + left.width).toBe(right.x);
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
    expect(await cheatsheetOpen(app!)).toBe(false);

    await clickMenuItem(app!, 'Keyboard Shortcuts');
    await expect.poll(() => cheatsheetOpen(app!)).toBe(true);

    await clickMenuItem(app!, 'Keyboard Shortcuts');
    await expect.poll(() => cheatsheetOpen(app!)).toBe(false);
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

  // ── Keyboard and screen reader (#3294) ──

  test('role="tablist" wraps the tabs only, not the buttons beside them', async () => {
    await waitForTabCount(page, 1);
    expect(
      await chromeEval<string | null>(
        app!,
        "document.getElementById('tabbar').getAttribute('role')"
      )
    ).toBeNull();
    expect(
      await chromeEval<string | null>(
        app!,
        "document.getElementById('tab-strip').getAttribute('role')"
      )
    ).toBe('tablist');
    // Nothing that is not a tab may sit inside the tablist.
    expect(
      await chromeEval<number>(
        app!,
        "[...document.getElementById('tab-strip').children].filter((el) => el.getAttribute('role') !== 'tab').length"
      )
    ).toBe(0);
  });

  test('exactly one tab is in the tab order, and it is the active one', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await waitForStripTabs(app!, 2);
    const activeId = (await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId;
    // Both halves as one predicate: joining the ids of every tab carrying a
    // tabindex of 0 equals the active id only when there is exactly one such
    // tab and it is the active one. Two tab stops would read "id1,id2".
    await expect
      .poll(() =>
        chromeEval<string>(
          app!,
          "[...document.querySelectorAll('#tab-strip .tab')].filter((el) => el.tabIndex === 0).map((el) => el.dataset.tabId).join(',')"
        )
      )
      .toBe(activeId);
  });

  test('an arrow key moves focus along the strip, and Enter activates the tab it lands on', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await waitForStripTabs(app!, 2);
    const state = await evaluateYcDesktop<TabResult>(page, 'getTabs');
    const first = state.tabs![0]!.id;
    expect(state.activeId).not.toBe(first);

    // Focus the strip's single tab stop the way Tab into the strip would.
    await chromeEval(app!, 'document.querySelector(\'#tab-strip .tab[tabindex="0"]\').focus()');
    await expect
      .poll(() => chromeEval<string>(app!, 'document.activeElement.className'))
      .toContain('tab');

    await pressChromeKey(app!, 'Left');
    // Focus moved, but nothing was activated: switching a tab swaps a whole
    // view, so arrowing past three tabs must not navigate through all three.
    await expect
      .poll(() => chromeEval<string>(app!, 'document.activeElement.dataset.tabId'))
      .toBe(first);
    expect((await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId).not.toBe(first);

    await pressChromeKey(app!, 'Return');
    await expect
      .poll(async () => (await evaluateYcDesktop<TabResult>(page, 'getTabs')).activeId)
      .toBe(first);
  });

  test('Delete on a focused tab closes it', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await waitForStripTabs(app!, 2);
    await chromeEval(app!, 'document.querySelector(\'#tab-strip .tab[tabindex="0"]\').focus()');
    await pressChromeKey(app!, 'Delete');
    await waitForTabCount(page, 1);
  });

  test('the strip keeps its elements across a poll, so focus in it survives', async () => {
    await evaluateYcDesktop(page, 'newTab');
    await waitForTabCount(page, 2);
    await waitForStripTabs(app!, 2);
    // Stamp the live elements and focus one, then force a real update by
    // opening a third tab. Waiting on the strip reaching three tabs is a
    // condition only a poll can satisfy, so it stands in for a fixed sleep -
    // and it is the stronger claim: identity survives an update, not just an
    // idle tick.
    await chromeEval(
      app!,
      "[...document.querySelectorAll('#tab-strip .tab')].forEach((el, i) => { el.dataset.stamp = 'e2e-' + i; });" +
        'document.querySelector(\'#tab-strip .tab[tabindex="0"]\').focus();'
    );
    await evaluateYcDesktop(page, 'newTab');
    await waitForStripTabs(app!, 3);

    expect(
      await chromeEval<string>(
        app!,
        "[...document.querySelectorAll('#tab-strip .tab')].map((el) => el.dataset.stamp || 'new').join(',')"
      )
    ).toBe('e2e-0,e2e-1,new');
    expect(await chromeEval<string>(app!, "document.activeElement.getAttribute('role')")).toBe(
      'tab'
    );
  });

  test('a close button names the tab it closes', async () => {
    await waitForTabCount(page, 1);
    const labels = await chromeEval<string[]>(
      app!,
      "[...document.querySelectorAll('#tab-strip .tab-close-btn')].map((el) => el.getAttribute('aria-label'))"
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).toMatch(/^Close .+/);
      expect(label).not.toBe('Close tab');
    }
  });

  test('tab search opened from the menu receives the keyboard, and hands it back', async () => {
    await waitForTabCount(page, 1);
    const beforeOpen = await focusMark(app!);
    await clickMenuItem(app!, 'Search Tabs…');

    await expect
      .poll(() => chromeEval<boolean>(app!, "document.getElementById('tab-search-dialog').open"))
      .toBe(true);
    // Two separate claims. In-document: showModal put the caret in the filter.
    // Across views: the app handed the keyboard to the view the panel lives in,
    // which is the half a page cannot do for itself and the half that was
    // missing - the caret blinked while the keystrokes went to the page below.
    await expect.poll(() => chromeEval<string>(app!, 'document.activeElement.id')).toBe('ts-input');
    await expect.poll(() => focusedSince(app!, beforeOpen, 'tabbar.html')).toBe(true);

    const beforeClose = await focusMark(app!);
    await pressChromeKey(app!, 'Escape');
    await expect
      .poll(() => chromeEval<boolean>(app!, "document.getElementById('tab-search-dialog').open"))
      .toBe(false);
    // ...and hands it back, rather than stranding it in a 40px strip.
    await expect.poll(() => focusedSince(app!, beforeClose, pimsServer.origin)).toBe(true);
  });

  test('tab search announces its result count, including no matches', async () => {
    await waitForTabCount(page, 1);
    await clickMenuItem(app!, 'Search Tabs…');
    await expect
      .poll(() => chromeEval<string>(app!, "document.getElementById('ts-status').textContent"))
      .toMatch(/tabs?$/);

    await chromeEval(
      app!,
      "const i = document.getElementById('ts-input'); i.value = 'zzzz-no-such-tab'; i.dispatchEvent(new Event('input'));"
    );
    await expect
      .poll(() => chromeEval<string>(app!, "document.getElementById('ts-status').textContent"))
      .toBe('No matching tabs');
    expect(
      await chromeEval<string>(app!, "document.getElementById('ts-list').getAttribute('role')")
    ).toBe('listbox');
  });

  test('the shortcut list takes focus and closes with Escape', async () => {
    await waitForTabCount(page, 1);
    await clickMenuItem(app!, 'Keyboard Shortcuts');
    await expect.poll(() => cheatsheetOpen(app!)).toBe(true);
    // showModal() puts focus on the first focusable thing in the panel, which
    // is its close button - the panel used to have neither.
    await expect.poll(() => chromeEval<string>(app!, 'document.activeElement.id')).toBe('cs-close');

    await pressChromeKey(app!, 'Escape');
    await expect.poll(() => cheatsheetOpen(app!)).toBe(false);
  });
});
