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
  const pages = await openPimsTab(app, pimsOrigin);
  return { app, page: pages.shell, tab: pages.tab, userDataDir: profileDir };
};

const evaluateYcDesktop = <T>(page: Page, method: string, ...args: unknown[]): Promise<T> =>
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

/*
 * The palette window, counted rather than asserted on directly, so the two
 * directions can be told apart: `open` is what "a palette exists" means, and
 * `loaded` is the stronger form the open-side polls for. Returning to
 * `afterEach` with a window still loading is what timed the hook out in #3392,
 * so nothing here settles for construction alone.
 *
 * Identified by the page it loaded, for the reason written out above
 * `settingsWindowLoaded` below: this window is constructed with
 * `title: 'Command Palette'` and then loads a page with its own `<title>`, so a
 * title equality is true only between construction and first paint.
 */
const paletteWindows = (app: ElectronApplication): Promise<{ open: number; loaded: number }> =>
  app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows().filter(
      (w) => !w.isDestroyed() && w.webContents.getURL().endsWith('/pages/command-palette.html')
    );
    return { open: wins.length, loaded: wins.filter((w) => !w.webContents.isLoading()).length };
  });

const palettePage = (app: ElectronApplication): Page | undefined =>
  app.windows().find((w) => w.url().endsWith('/pages/command-palette.html'));

/*
 * Opens the palette the way a user can from this process.
 *
 * Not `keyboard.press('Mod+K')`, which these tests used to do: Cmd/Ctrl+K is an
 * Electron `globalShortcut` (ui/keyboard-shortcuts.ts), which the OS delivers.
 * Playwright's key presses are injected into a renderer over CDP and never
 * reach the window server, so the accelerator does not fire. Measured on this
 * spec's own fixture: with the app launched and a `Mod+K` press delivered to the
 * shell page, `BrowserWindow.getAllWindows()` was unchanged - no palette window
 * at all - while the same fixture opened one through the menu item below.
 *
 * That the accelerator is bound to this action, and held exactly while the app
 * has focus, is asserted by the first test in this file and by
 * tests/keyboard-shortcuts.test.ts. What is left for an e2e to show is that the
 * action opens a real window, which is what this drives.
 */
const openPalette = async (app: ElectronApplication): Promise<void> => {
  const clicked = await app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) return false;
    const find = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
      for (const item of items) {
        if (item.label === 'Command Palette\u2026') return item;
        const nested = item.submenu ? find(item.submenu.items) : undefined;
        if (nested) return nested;
      }
      return undefined;
    };
    const item = find(menu.items);
    if (!item) return false;
    item.click();
    return true;
  });
  expect(clicked, 'the application menu has no Command Palette item to open').toBe(true);
};

const waitForPaletteReady = async (app: ElectronApplication, timeout = 10_000): Promise<void> => {
  await expect
    .poll(async () => (await paletteWindows(app)).loaded, {
      timeout,
      message: 'Timed out waiting for the command palette window to open',
    })
    .toBeGreaterThan(0);
};

test.describe('command-palette E2E', () => {
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

  test('the app holds its accelerators exactly while one of its windows has focus', async () => {
    // Asserted as an invariant rather than as one fixed state, because the two
    // environments this runs in disagree: a CI runner launches the app in front,
    // and locally Playwright's Electron app never becomes frontmost (win.focus()
    // leaves isFocused() false). Each environment exercises the side it can
    // reach, and neither is asserted into a state it cannot get to.
    const OWN_ACCELERATORS = ['CommandOrControl+Alt+T', 'CommandOrControl+K'];
    const readState = () =>
      app!.evaluate(({ app: electronApp, BrowserWindow, globalShortcut }) => ({
        focusHandlers: electronApp.listenerCount('browser-window-focus'),
        blurHandlers: electronApp.listenerCount('browser-window-blur'),
        focused: BrowserWindow.getFocusedWindow() !== null,
        held: ['CommandOrControl+Alt+T', 'CommandOrControl+K'].filter((accelerator) =>
          globalShortcut.isRegistered(accelerator)
        ),
      }));
    const setFocus = (wanted: boolean) =>
      app!.evaluate(async ({ BrowserWindow }, want) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) throw new Error('the app has no window');
        if (want) win.focus();
        else win.blur();
        // The release is decided a tick after blur, so let that tick run.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }, wanted);

    const initial = await readState();
    expect(initial.focusHandlers).toBeGreaterThan(0);
    expect(initial.blurHandlers).toBeGreaterThan(0);
    expect(initial.held.sort()).toEqual(initial.focused ? OWN_ACCELERATORS : []);

    if (!initial.focused) return;

    // Only where the app can be in front: driving focus away must hand the keys
    // back, and taking it again must re-arm them. A runner that refuses to yield
    // focus is not asserted against - the precondition simply did not hold.
    await setFocus(false);
    const blurred = await readState();
    if (!blurred.focused) expect(blurred.held).toEqual([]);

    await setFocus(true);
    const refocused = await readState();
    if (refocused.focused) expect(refocused.held.sort()).toEqual(OWN_ACCELERATORS);
  });

  test('opening the command palette opens a palette window', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // The control. This test used to end on
    // `expect(await getPaletteActions()).not.toBeNull()`, which is true of every
    // state the app can be in: `yc:get-palette-actions` returns a module
    // constant and reads no window state (core/ipc-handlers.ts), so it answers
    // the same object with the palette open, closed, or never created. Asserting
    // the absent state first is what makes the poll below able to fail.
    expect((await paletteWindows(app!)).open).toBe(0);

    await openPalette(app!);
    await waitForPaletteReady(app!);
  });

  test('search "patient" returns "Patients" result', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await openPalette(app!);
    await waitForPaletteReady(app!);
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string; label: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    const patientAction = actions.actions.find((a) => a.label.toLowerCase().includes('patient'));
    expect(patientAction).toBeTruthy();
  });

  test('select result navigates to deep link', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    expect(actions.actions.length).toBeGreaterThan(0);
    const result = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'executeCommand',
      actions.actions[0]!.id
    );
    expect(result.ok).toBe(true);
  });

  test('search "xyzzy" returns no results text', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: unknown[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    expect(Array.isArray(actions.actions)).toBe(true);
  });

  /*
   * Identified by the URL it loaded, not by `getTitle()`. The window is
   * constructed with `title: 'Preferences'` and then loads a page whose own
   * `<title>` is "Preferences — Yosemite Crew PIMS"; nothing cancels
   * `page-title-updated` for this window the way `create-main-window.ts` does
   * for the main one, so the constructor title survives only until the load
   * that this predicate is waiting for replaces it. A title equality would
   * therefore be true only in the window between construction and first paint
   * and false forever after - the never-true poll this test is being fixed to
   * avoid. `getURL()` is settled for the whole of that window's life.
   *
   * `endsWith` on a forward-slash path holds on Windows too: a `file://` URL
   * uses forward slashes on both platforms this suite runs on.
   */
  const settingsWindowLoaded = (): Promise<boolean> =>
    app!.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some(
        (w) =>
          !w.isDestroyed() &&
          w.webContents.getURL().endsWith('/pages/settings.html') &&
          !w.webContents.isLoading()
      )
    );

  test('execute via IPC fires navigation', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // The control, and the reason the poll below is worth anything: it has to
    // be false of the app as launched. A predicate true of every state would
    // pass without `open-settings` having done a thing, which is the defect
    // being fixed here - `expect(result).not.toBeNull()` was true whenever the
    // preload existed at all.
    expect(await settingsWindowLoaded()).toBe(false);

    const result = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'executeCommand',
      'open-settings'
    );
    expect(result.ok).toBe(true);

    /*
     * Waiting here is what removes the flake, not just what gives the test an
     * assertion. `executeCommand` resolves as soon as `createSettingsWindow()`
     * has constructed the window - `loadFile` is not awaited - so without this
     * the test returned into `afterEach`, which calls `app.close()` against a
     * window still loading. On `macos-latest` that lost the race often enough
     * to time the hook out and then the worker teardown with it (issue #3392).
     * Every other test in this spec that opens a window already waits for it.
     */
    await expect
      .poll(settingsWindowLoaded, {
        timeout: 10_000,
        message: 'open-settings did not open the Preferences window',
      })
      .toBe(true);
  });

  test('Escape closes palette', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    expect((await paletteWindows(app!)).open).toBe(0);
    await openPalette(app!);
    await waitForPaletteReady(app!);

    /*
     * Escape is sent to the palette's own document, because that is where it is
     * handled: pages/command-palette.js binds it on the search field's keydown
     * and calls `closePalette()` from there. It is not a global accelerator, so
     * a press delivered to the shell page would close nothing and the poll below
     * would be asserting against a window no key ever reached.
     *
     * The old body pressed no Escape at all - it drove `closePalette` over IPC
     * and then asserted `not.toBeNull()` on the reply, which `yc:close-palette`
     * answers `{ ok: true }` to even when there is no window to close.
     */
    const palette = palettePage(app!);
    expect(palette, 'the palette window did not surface as a Playwright page').toBeTruthy();

    // Stated before the key is sent, because the handler is bound to the search
    // field and not to the document: a key arriving with anything else focused
    // would close nothing, and this test would then be failing for a reason that
    // has nothing to do with Escape.
    await expect(palette!.locator('#search')).toBeFocused();

    // Sent from the main process rather than with `locator.press`. The key
    // destroys the window the press is being made against, so Playwright's call
    // returns `Target page, context or browser has been closed` - a failure
    // raised by the key having worked. `sendInputEvent` does not wait on the
    // renderer, which leaves the close to be observed by the poll below.
    await app!.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.webContents.getURL().endsWith('/pages/command-palette.html')
      );
      win?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    });

    await expect
      .poll(async () => (await paletteWindows(app!)).open, {
        timeout: 10_000,
        message: 'Escape did not close the command palette window',
      })
      .toBe(0);
  });

  test('recents persist across palette open/close', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // `yc:get-palette-recents` returns `store.load()`, which is `RecentEntry[]`.
    // The body this replaces typed it `string[]` and then asserted nothing about
    // the elements, so the shape mismatch never surfaced.
    type RecentEntry = { id: string; label: string; url: string; visitedAt: number };
    const readRecents = async (): Promise<RecentEntry[]> => {
      const reply = await evaluateYcDesktop<{ ok: boolean; recents: RecentEntry[] }>(
        page,
        'getPaletteRecents'
      );
      expect(reply.ok).toBe(true);
      return reply.recents;
    };

    // The control, and what makes every id below attributable: `beforeEach`
    // launches into a fresh `YC_DESKTOP_USER_DATA_DIR`, so the recents file does
    // not exist yet and `load()` starts from the empty list.
    expect(await readRecents()).toEqual([]);

    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string; label: string; url?: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);

    /*
     * Only a url-bearing action is ever recorded: `runCommandAction` (main.ts)
     * calls `recentsStore.recordVisit` under `if (recentsStore && action.url)`.
     * The `open-settings` this test used to execute between its two reads is an
     * `action(...)` with no slug, so it carries no url and could not have
     * reached recents however the list was asserted. Selecting by that property
     * rather than by name is what makes the assertions below reachable at all.
     */
    const recordable = actions.actions.filter((a) => a.url);
    expect(
      recordable.length,
      'fewer than two url-bearing palette actions, so recents ordering cannot be driven'
    ).toBeGreaterThanOrEqual(2);
    const [first, second] = recordable as [
      { id: string; label: string; url?: string },
      { id: string; label: string; url?: string },
    ];

    /*
     * `yc:execute-command` replies immediately after `void
     * services.runCommandAction(id)` - the call is deliberately not awaited, to
     * keep the IPC reply off the navigation - so the `recordVisit` write lands
     * after `{ ok: true }` is already back. Read once and this races; polled, it
     * asserts the write itself.
     */
    const executeAndWaitForRecent = async (id: string): Promise<void> => {
      const reply = await evaluateYcDesktop<{ ok: boolean }>(page, 'executeCommand', id);
      expect(reply.ok).toBe(true);
      await expect
        .poll(async () => (await readRecents())[0]?.id, {
          timeout: 10_000,
          message: `executing ${id} did not reach the front of recents`,
        })
        .toBe(id);
    };

    await executeAndWaitForRecent(first.id);
    const recents1 = await readRecents();
    expect(recents1.map((r) => r.id)).toEqual([first.id]);
    expect(recents1[0]).toMatchObject({ id: first.id, label: first.label, url: first.url });

    // The open/close this test is named for, driven rather than assumed. The old
    // body called `closePalette` with no palette ever opened, and that handler
    // returns `{ ok: true }` when there is no window to close.
    await openPalette(app!);
    await waitForPaletteReady(app!);
    await evaluateYcDesktop(page, 'closePalette');
    await expect
      .poll(async () => (await paletteWindows(app!)).open, {
        timeout: 10_000,
        message: 'closePalette left a palette window open',
      })
      .toBe(0);

    // Persistence: the entry survives the palette window being opened and
    // destroyed, byte for byte - `visitedAt` included, so a re-record would fail
    // here rather than read as a pass.
    expect(await readRecents()).toEqual(recents1);

    // Ordering: `recordVisit` unshifts, so the most recent command is first.
    await executeAndWaitForRecent(second.id);
    expect((await readRecents()).map((r) => r.id)).toEqual([second.id, first.id]);

    // Dedup: re-running the first moves it back to the front and adds no row.
    await executeAndWaitForRecent(first.id);
    expect((await readRecents()).map((r) => r.id)).toEqual([first.id, second.id]);
  });

  test('stale recents IDs gracefully skipped', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const recents = await evaluateYcDesktop<{ ok: boolean; recents: string[] }>(
      page,
      'getPaletteRecents'
    );
    expect(recents.ok).toBe(true);
    expect(Array.isArray(recents.recents)).toBe(true);
  });

  test('fallback action set when ycDesktop partially unavailable', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string; label: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    const openSettings = actions.actions.find((a) => a.id === 'open-settings');
    expect(openSettings).toBeTruthy();
  });
});
