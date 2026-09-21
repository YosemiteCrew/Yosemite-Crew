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

test.describe('command-palette E2E', () => {
  let app: ElectronApplication | undefined;
  let page: Page;
  let tab: Page;

  const PALETTE_PAGE = '/pages/command-palette.html';

  /*
   * The palette is observed as a real window, not as a reply from the preload
   * bridge. `yc:get-palette-actions` returns a module constant and reads no
   * window state, so the previous `getPaletteActions() !== null` poll was
   * already satisfied before Cmd+K was pressed and synchronised nothing
   * (issue #3396). Keyed on the loaded URL for the same reason as
   * `settingsWindowLoaded` below: the window is constructed with
   * `title: 'Command Palette'` and the title is not a stable identifier across
   * the load, while the URL is settled for the whole of the window's life.
   */
  const paletteWindowOpen = (): Promise<boolean> =>
    app!.evaluate(
      ({ BrowserWindow }, palettePage) =>
        BrowserWindow.getAllWindows().some(
          (w) =>
            !w.isDestroyed() &&
            w.webContents.getURL().endsWith(palettePage) &&
            !w.webContents.isLoading()
        ),
      PALETTE_PAGE
    );

  const waitForPaletteReady = async (timeout = 5000): Promise<void> => {
    await expect
      .poll(paletteWindowOpen, {
        timeout,
        message: 'Timed out waiting for the command palette window to open',
      })
      .toBe(true);
  };

  /*
   * Escape is handled by the palette page's own keydown listener, which calls
   * `yc.closePalette()`. The key therefore has to reach that window's
   * webContents; `page.keyboard.press` on the main window would exercise
   * nothing. Same main-process technique `tabs.e2e.ts` uses to drive its
   * cheatsheet.
   */
  const pressPaletteKey = async (keyCode: string): Promise<void> => {
    await app!.evaluate(
      ({ webContents }, { code, palettePage }) => {
        const wc = webContents
          .getAllWebContents()
          .find((c) => c.getURL().endsWith(palettePage) && !c.isDestroyed());
        if (!wc) throw new Error('the command palette window is not loaded');
        wc.focus();
        wc.sendInputEvent({ type: 'keyDown', keyCode: code });
        wc.sendInputEvent({ type: 'char', keyCode: code });
        wc.sendInputEvent({ type: 'keyUp', keyCode: code });
      },
      { code: keyCode, palettePage: PALETTE_PAGE }
    );
  };
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

  test('the Command Palette menu item opens the palette window', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    // The control. Without it the poll below could be true of every app state,
    // which is how the old assertion passed: it only ever showed that the
    // preload bridge exposed `getPaletteActions`.
    expect(await paletteWindowOpen()).toBe(false);

    await clickMenuItem(app!, 'Command Palette\u2026');
    await waitForPaletteReady();
  });

  test('search "patient" returns "Patients" result', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await clickMenuItem(app!, 'Command Palette\u2026');
    await waitForPaletteReady();
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
    expect(await paletteWindowOpen()).toBe(false);

    await clickMenuItem(app!, 'Command Palette\u2026');
    await waitForPaletteReady();

    /*
     * Asserted immediately before the key, so that a palette which closed for
     * some other reason - the window closes itself on `blur` - fails here
     * rather than satisfying the "it is gone" poll below without Escape having
     * done anything.
     */
    expect(await paletteWindowOpen()).toBe(true);

    await pressPaletteKey('Escape');

    await expect
      .poll(paletteWindowOpen, {
        timeout: 5000,
        message: 'Escape did not close the command palette window',
      })
      .toBe(false);
  });

  test('recents persist across palette open/close', async () => {
    await expect(tab.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    const actions = await evaluateYcDesktop<{
      ok: boolean;
      actions: { id: string }[];
    }>(page, 'getPaletteActions');
    expect(actions.ok).toBe(true);
    if (actions.actions.length > 0) {
      await evaluateYcDesktop(page, 'executeCommand', actions.actions[0]!.id);
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
