import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';
import { clickMenuItem } from './menu';

// The in-app lock screen only mounts on the biometric path, and biometric
// unlock is macOS-only (Touch ID), so there is nothing to drive elsewhere.
test.skip(process.platform !== 'darwin', 'the idle lock overlay is macOS-only (Touch ID)');

const APP_ROOT = path.resolve(__dirname, '..', '..');
const ELECTRON_EXECUTABLE = electronPath as unknown as string;
const LOCK_PAGE = 'idle-lock.html';

// Each page counts the keydowns and mousedowns it receives, so a spec can tell
// whether a keystroke sent at it arrived (see pressKey).
const startPimsServer = async (): Promise<{ origin: string; close: () => void }> => {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><html><head><meta charset="utf-8"><title>PIMS</title></head><body>' +
        '<h1>PIMS App</h1>' +
        '<script>window.__keys = 0; window.__clicks = 0;' +
        "addEventListener('keydown', () => window.__keys++);" +
        "addEventListener('mousedown', () => window.__clicks++);</script>" +
        '</body></html>'
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not bind test server.');
  return { origin: `http://127.0.0.1:${address.port}`, close: () => server.close() };
};

const launchLockableApp = async (
  origin: string,
  profileDir: string,
  startPath = '/signin'
): Promise<{ app: ElectronApplication; shell: Page }> => {
  fs.writeFileSync(
    path.join(profileDir, 'settings.json'),
    JSON.stringify({ biometricLockEnabled: true })
  );
  const app = await electron.launch({
    executablePath: ELECTRON_EXECUTABLE,
    // No Keychain prompt on the machine running the suite.
    args: [APP_ROOT, '--use-mock-keychain'],
    env: {
      ...process.env,
      YC_DESKTOP_START_URL: `${origin}${startPath}`,
      YC_DESKTOP_ALLOWED_ORIGINS: origin,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: profileDir,
      YC_DESKTOP_IDLE_LOCK_MINUTES: '1',
    },
  });
  const { shell } = await openPimsTab(app, origin);
  // Make the machine look idle and Touch ID look present. The prompt never
  // settles on its own: a spec unlocks by resolving it (see unlockWithTouchId).
  //
  // Also record every web contents the app focuses. A test-launched app is not
  // allowed to become the active macOS app, so its window is never key and
  // isFocused() stays false whatever the app does; which contents the app hands
  // focus to is the part the app controls.
  await app.evaluate(({ powerMonitor, systemPreferences, webContents }) => {
    const g = globalThis as Record<string, unknown>;
    const touch: Array<() => void> = [];
    const focused: number[] = [];
    g.__touch = touch;
    g.__focused = focused;
    Object.assign(powerMonitor, { getSystemIdleTime: () => 3600 });
    Object.assign(systemPreferences, {
      canPromptTouchID: () => true,
      promptTouchID: () => new Promise<void>((resolve) => touch.push(resolve)),
    });
    let proto = Object.getPrototypeOf(webContents.getAllWebContents()[0]);
    while (proto && !Object.prototype.hasOwnProperty.call(proto, 'focus')) {
      proto = Object.getPrototypeOf(proto);
    }
    const focus = proto.focus as (this: Electron.WebContents) => void;
    proto.focus = function (this: Electron.WebContents) {
      focused.push(this.id);
      return focus.call(this);
    };
  });
  return { app, shell };
};

// The idle check runs every 30 seconds, so the first lock can take that long.
const waitForLock = async (app: ElectronApplication): Promise<Page> => {
  let lockPage: Page | undefined;
  await expect
    .poll(() => (lockPage = app.windows().find((p) => p.url().includes(LOCK_PAGE))) ?? null, {
      timeout: 45_000,
      message: 'the idle lock never engaged',
    })
    .not.toBeNull();
  const page = lockPage as Page;
  await page.waitForLoadState('load');
  return page;
};

const unlockWithTouchId = (app: ElectronApplication): Promise<void> =>
  app.evaluate(() => {
    const touch = (globalThis as Record<string, unknown>).__touch as Array<() => void>;
    const resolve = touch.shift();
    if (!resolve) throw new Error('no Touch ID prompt is pending');
    resolve();
  });

// Native input to the web contents at `url` (or the lock page). This goes
// through the same before-input-event path as a real keyboard; Playwright's
// page.keyboard does not, it injects straight into the renderer over CDP.
const sendInput = (
  app: ElectronApplication,
  url: string,
  events: Array<Electron.KeyboardInputEvent | Electron.MouseInputEvent>
): Promise<void> =>
  app.evaluate(
    ({ webContents }, { url: target, events: input }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().includes(target));
      if (!wc) throw new Error(`no web contents at ${target}`);
      for (const event of input) wc.sendInputEvent(event);
    },
    { url, events }
  );

const keyPress = (keyCode: string): Electron.KeyboardInputEvent[] => [
  { type: 'keyDown', keyCode },
  { type: 'char', keyCode },
  { type: 'keyUp', keyCode },
];

// What the page at `url` has counted; -1 until that page has loaded.
const pageCount = (
  app: ElectronApplication,
  url: string,
  counter: 'keys' | 'clicks'
): Promise<number> =>
  app.evaluate(
    async ({ webContents }, { url: target, counter: which }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL() === target);
      const counts = (
        wc ? await wc.executeJavaScript('({ keys: window.__keys, clicks: window.__clicks })') : {}
      ) as Record<string, unknown>;
      const n = counts[which];
      return typeof n === 'number' ? n : -1;
    },
    { url, counter }
  );

const keysReceived = (app: ElectronApplication, url: string): Promise<number> =>
  pageCount(app, url, 'keys');

// Press a key on a tab page and wait until the page has handled it, so a count
// read afterwards is final. Input to one web contents is handled in order, and
// the lock holds keys only, so a click sent right after the key is a marker:
// once the page has seen the click, it has seen (or never got) the key.
const pressKey = async (app: ElectronApplication, url: string, keyCode: string): Promise<void> => {
  const clicks = await pageCount(app, url, 'clicks');
  await sendInput(app, url, [
    ...keyPress(keyCode),
    { type: 'mouseDown', x: 1, y: 1, button: 'left', clickCount: 1 },
    { type: 'mouseUp', x: 1, y: 1, button: 'left', clickCount: 1 },
  ]);
  await expect.poll(() => pageCount(app, url, 'clicks')).toBe(clicks + 1);
};

// How many focus calls the app has made so far; pass it to focusedSince.
const focusMark = (app: ElectronApplication): Promise<number> =>
  app.evaluate(() => ((globalThis as Record<string, unknown>).__focused as number[]).length);

// Whether the app has focused something since `mark`, and the latest was the
// web contents at `url`.
const focusedSince = (app: ElectronApplication, mark: number, url: string): Promise<boolean> =>
  app.evaluate(
    ({ webContents }, { mark: from, url: target }) => {
      const focused = ((globalThis as Record<string, unknown>).__focused as number[]).slice(from);
      const wc = webContents.getAllWebContents().find((w) => w.getURL().includes(target));
      return Boolean(wc) && focused.at(-1) === wc!.id;
    },
    { mark, url }
  );

// URL of the topmost view in the main window: what pointer input lands on.
const topmostView = (app: ElectronApplication): Promise<string> =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0);
    const top = win?.contentView.children.at(-1) as { webContents?: { getURL(): string } };
    return top?.webContents?.getURL() ?? '';
  });

const tabCount = async (shell: Page): Promise<number> =>
  shell.evaluate(async () => {
    const yc = (globalThis as Record<string, unknown>).ycDesktop as {
      getTabs: () => Promise<{ tabs: unknown[] }>;
    };
    return (await yc.getTabs()).tabs.length;
  });

const callShell = <T>(shell: Page, method: string, ...args: unknown[]): Promise<T> =>
  shell.evaluate(
    ({ m, a }) => {
      const yc = (globalThis as Record<string, unknown>).ycDesktop as Record<
        string,
        (...x: unknown[]) => Promise<unknown>
      >;
      return yc[m](...a);
    },
    { m: method, a: args }
  ) as Promise<T>;

test.describe('idle lock', () => {
  let app: ElectronApplication | undefined;
  let server: { origin: string; close: () => void };
  let profileDir: string;

  test.beforeEach(() => {
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-idle-lock-'));
  });

  test.afterEach(async () => {
    await app?.close().catch(() => undefined);
    server?.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
    app = undefined;
  });

  test('takes focus, holds the workspace until unlock, then hands focus back', async () => {
    test.setTimeout(120_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir);
    app = launched.app;
    const { shell } = launched;
    const firstTab = `${server.origin}/signin`;

    const lockPage = await waitForLock(app);

    // The lock page has keyboard focus, on the Unlock button of a modal card.
    expect(await focusedSince(app, 0, LOCK_PAGE)).toBe(true);
    expect(await lockPage.evaluate(() => document.activeElement?.id)).toBe('unlock');
    expect(
      await lockPage.evaluate(() => document.getElementById('lockCard')?.matches(':modal'))
    ).toBe(true);

    // A keystroke aimed at the tab underneath never arrives.
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(0);

    // A tab opened during the lock is held too, and lands under the overlay.
    const opened = await callShell<{ ok: boolean }>(shell, 'newTab', `${server.origin}/opened`);
    expect(opened.ok).toBe(true);
    await expect.poll(() => keysReceived(app!, `${server.origin}/opened`)).toBe(0);
    await pressKey(app, `${server.origin}/opened`, 'A');
    expect(await keysReceived(app, `${server.origin}/opened`)).toBe(0);
    expect(await topmostView(app)).toContain(LOCK_PAGE);

    // So is a tab switched to during the lock.
    const tabs = await callShell<{ tabs: Array<{ id: string; url: string }> }>(shell, 'getTabs');
    const first = tabs.tabs.find((t) => t.url === firstTab);
    expect((await callShell<{ ok: boolean }>(shell, 'activateTab', first!.id)).ok).toBe(true);
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(0);
    expect(await topmostView(app)).toContain(LOCK_PAGE);

    // Menu items act on nothing behind the lock.
    const before = await tabCount(shell);
    await clickMenuItem(app, 'New Tab');
    expect(await tabCount(shell)).toBe(before);

    // Nor do palette commands (the tray's quick actions run the same way): no
    // new tab, and no floating window of the page behind the lock. Both run
    // synchronously inside the IPC call, so its reply means they are done.
    const windows = () =>
      app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    const windowsBefore = await windows();
    await callShell(shell, 'executeCommand', 'tab:new');
    await callShell(shell, 'executeCommand', 'pin-current');
    expect(await tabCount(shell)).toBe(before);
    expect(await windows()).toBe(windowsBefore);

    // Nor does a trackpad swipe move the tab's history.
    const swipes = await app.evaluate(({ BrowserWindow, webContents }, url) => {
      const history = webContents
        .getAllWebContents()
        .find((w) => w.getURL() === url)!.navigationHistory;
      const { goBack, goForward } = history;
      let moves = 0;
      history.goBack = () => void moves++;
      history.goForward = () => void moves++;
      const win = BrowserWindow.getAllWindows()[0];
      win.emit('swipe', {}, 'right');
      win.emit('swipe', {}, 'left');
      Object.assign(history, { goBack, goForward });
      return moves;
    }, firstTab);
    expect(swipes).toBe(0);

    // Escape cannot dismiss the card, pressed once or again, and Enter then
    // presses the Unlock button that still has focus. (Enter going through also
    // means both Escapes have been handled before the card is checked.)
    await sendInput(app, LOCK_PAGE, [...keyPress('Escape'), ...keyPress('Escape')]);
    await sendInput(app, LOCK_PAGE, keyPress('Enter'));
    await expect
      .poll(() => lockPage.evaluate(() => document.getElementById('lockStatus')?.textContent))
      .toBe('Verifying…');
    expect(
      await lockPage.evaluate(() => document.getElementById('lockCard')?.hasAttribute('open'))
    ).toBe(true);

    // Unlock: the overlay goes, the active tab has focus and takes keys again.
    const beforeUnlock = await focusMark(app);
    await unlockWithTouchId(app);
    await expect.poll(() => app!.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
    expect(await focusedSince(app, beforeUnlock, firstTab)).toBe(true);
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(1);
  });

  // Signed in, the reopened window rebuilds the tabs; signed out (the tab is on
  // a public route), it opens on the welcome screen. The lock covers either.
  for (const [session, startPath, reopensOn] of [
    ['signed in', '/dashboard', '/dashboard'],
    ['signed out', '/signin', 'welcome.html'],
  ] as const) {
    test(`a window reopened while locked is covered by the lock (${session})`, async () => {
      test.setTimeout(120_000);
      server = await startPimsServer();
      const launched = await launchLockableApp(server.origin, profileDir, startPath);
      app = launched.app;

      await waitForLock(app);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
      await expect
        .poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length))
        .toBe(0);

      // macOS keeps the app running; clicking the Dock icon reopens the window.
      // Moving the lock onto it must hand the lock page focus again.
      const beforeReopen = await focusMark(app);
      await app.evaluate(({ app: electronApp }) => electronApp.emit('activate'));
      await expect
        .poll(() => topmostView(app!), { message: 'the reopened window is not under the lock' })
        .toContain(LOCK_PAGE);
      expect(await focusedSince(app, beforeReopen, LOCK_PAGE)).toBe(true);
      // And the window underneath is the one this case is about.
      await expect
        .poll(() =>
          app!.evaluate(({ BrowserWindow }, target) => {
            const win = BrowserWindow.getAllWindows()[0];
            const views = win.contentView.children as unknown as Array<{
              webContents?: { getURL(): string };
            }>;
            return [win.webContents, ...views.map((v) => v.webContents)].some((wc) =>
              wc?.getURL().endsWith(target)
            );
          }, reopensOn)
        )
        .toBe(true);
    });
  }
});
