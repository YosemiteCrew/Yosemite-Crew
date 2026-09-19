import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';
import { clickMenuItem } from './menu';
import { SHORTCUTS } from '../../src/ui/keyboard-shortcuts';

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

// Loaded ahead of the app (-r): keeps every callback the app hands to
// globalShortcut.register, so a spec can run one the way the OS does when its
// chord is pressed. Playwright cannot press an OS-wide shortcut.
const SHORTCUT_RECORDER = `'use strict';
const electron = require('electron');
electron.app.once('ready', () => {
  const { globalShortcut } = electron;
  const register = globalShortcut.register.bind(globalShortcut);
  const shortcuts = new Map();
  globalThis.__shortcuts = shortcuts;
  globalShortcut.register = (accelerator, callback) => {
    shortcuts.set(accelerator, callback);
    return register(accelerator, callback);
  };
});
`;

type LaunchOptions = {
  startPath?: string;
  // Off: the lock signs out instead of showing the lock screen.
  biometric?: boolean;
  // Off: the app stays on its welcome screen, with no tabs.
  signIn?: boolean;
  env?: Record<string, string>;
};

const launchLockableApp = async (
  origin: string,
  profileDir: string,
  { startPath = '/signin', biometric = true, signIn = true, env = {} }: LaunchOptions = {}
): Promise<{ app: ElectronApplication; shell: Page }> => {
  fs.writeFileSync(
    path.join(profileDir, 'settings.json'),
    JSON.stringify({ biometricLockEnabled: biometric })
  );
  const recorder = path.join(profileDir, 'record-shortcuts.js');
  fs.writeFileSync(recorder, SHORTCUT_RECORDER);
  const app = await electron.launch({
    executablePath: ELECTRON_EXECUTABLE,
    // No Keychain prompt on the machine running the suite.
    args: ['-r', recorder, APP_ROOT, '--use-mock-keychain'],
    env: {
      ...process.env,
      YC_DESKTOP_START_URL: `${origin}${startPath}`,
      YC_DESKTOP_ALLOWED_ORIGINS: origin,
      YC_DESKTOP_DISABLE_UPDATES: '1',
      YC_DESKTOP_USER_DATA_DIR: profileDir,
      YC_DESKTOP_IDLE_LOCK_MINUTES: '1',
      ...env,
    },
  });
  const shell = signIn ? (await openPimsTab(app, origin)).shell : await app.firstWindow();
  // Touch ID looks present, and the machine looks busy until a spec calls
  // goIdle. The prompt never settles on its own: a spec passes or cancels it
  // (see answerTouchId).
  //
  // Also record every web contents the app focuses, and every URL it loads
  // into one. A test-launched app is not allowed to become the active macOS
  // app, so its window is never key and isFocused() stays false whatever the
  // app does; which contents the app hands focus to is the part the app
  // controls.
  await app.evaluate(({ powerMonitor, systemPreferences, webContents }) => {
    const g = globalThis as Record<string, unknown>;
    const touch: Array<(ok: boolean) => void> = [];
    const focused: number[] = [];
    const loads: string[] = [];
    g.__touch = touch;
    g.__focused = focused;
    g.__loads = loads;
    g.__idleSeconds = 0;
    Object.assign(powerMonitor, { getSystemIdleTime: () => g.__idleSeconds });
    Object.assign(systemPreferences, {
      canPromptTouchID: () => true,
      promptTouchID: () =>
        new Promise<void>((resolve, reject) =>
          touch.push((ok) => (ok ? resolve() : reject(new Error('cancelled'))))
        ),
    });
    const protoWith = (name: string) => {
      let proto = Object.getPrototypeOf(webContents.getAllWebContents()[0]);
      while (proto && !Object.prototype.hasOwnProperty.call(proto, name)) {
        proto = Object.getPrototypeOf(proto);
      }
      return proto;
    };
    const focusProto = protoWith('focus');
    const focus = focusProto.focus as (this: Electron.WebContents) => void;
    focusProto.focus = function (this: Electron.WebContents) {
      focused.push(this.id);
      return focus.call(this);
    };
    const loadProto = protoWith('loadURL');
    const loadURL = loadProto.loadURL as (this: Electron.WebContents, url: string) => unknown;
    loadProto.loadURL = function (this: Electron.WebContents, url: string, ...rest: unknown[]) {
      loads.push(url);
      return (loadURL as (...a: unknown[]) => unknown).call(this, url, ...rest);
    };
  });
  return { app, shell };
};

// Make the machine look idle; the lock engages on the next idle check.
const goIdle = (app: ElectronApplication): Promise<void> =>
  app.evaluate(() => {
    (globalThis as Record<string, unknown>).__idleSeconds = 3600;
  });

// The idle check runs every 30 seconds, so the first lock can take that long.
const waitForLock = async (app: ElectronApplication): Promise<Page> => {
  await goIdle(app);
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

// Settle the pending Touch ID prompt: pass it, or cancel it.
const answerTouchId = (app: ElectronApplication, ok: boolean): Promise<void> =>
  app.evaluate((_electron, pass) => {
    const touch = (globalThis as Record<string, unknown>).__touch as Array<(ok: boolean) => void>;
    const answer = touch.shift();
    if (!answer) throw new Error('no Touch ID prompt is pending');
    answer(pass);
  }, ok);

const unlockWithTouchId = (app: ElectronApplication): Promise<void> => answerTouchId(app, true);

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

const click = (): Electron.MouseInputEvent[] => [
  { type: 'mouseDown', x: 1, y: 1, button: 'left', clickCount: 1 },
  { type: 'mouseUp', x: 1, y: 1, button: 'left', clickCount: 1 },
];

// A view that was attached moments ago drops pointer input until it has been
// laid out and painted: a mousedown has to be hit-tested against the view's
// compositor data, and there is none yet. A keystroke needs no hit test and
// lands throughout. So the click pressKey uses as its marker is more fragile
// than the keystroke it is there to guard, and on a slow machine it loses that
// race — which is what made this spec flaky on a tab opened under the lock.
//
// Bring the pointer path up before trusting the marker: send clicks, not keys,
// until one is counted. Clicks only, so the key counts this guards are left
// alone; and a real failure to deliver still fails, it is not waited away.
const waitForPointerInput = async (app: ElectronApplication, url: string): Promise<void> => {
  const clicks = await pageCount(app, url, 'clicks');
  await expect
    .poll(
      async () => {
        await sendInput(app, url, click());
        return pageCount(app, url, 'clicks');
      },
      { timeout: 20_000, message: `no pointer input ever reached ${url}` }
    )
    .toBeGreaterThan(clicks);
};

// Press a key on a tab page and wait until the page has handled it, so a count
// read afterwards is final. Input to one web contents is handled in order, and
// the lock holds keys only, so a click sent right after the key is a marker:
// once the page has seen the click, it has seen (or never got) the key. The
// page must already be taking pointer input for that to hold — see
// waitForPointerInput, which every freshly attached view goes through first. A
// view first attached under the lock is never painted, so it never takes
// pointer input at all; keyHeld checks the hold on that one instead.
const pressKey = async (app: ElectronApplication, url: string, keyCode: string): Promise<void> => {
  const clicks = await pageCount(app, url, 'clicks');
  await sendInput(app, url, [...keyPress(keyCode), ...click()]);
  await expect.poll(() => pageCount(app, url, 'clicks')).toBe(clicks + 1);
};

// Whether the app drops a key press aimed at the web contents at `url` before
// it reaches the page, by running the app's own before-input-event handling the
// way a real key press does. For a page that has never been on screen: input
// sent to one is not delivered at all, so pressKey's marker click never lands.
const keyHeld = (app: ElectronApplication, url: string): Promise<boolean> =>
  app.evaluate(({ webContents }, target) => {
    const wc = webContents.getAllWebContents().find((w) => w.getURL() === target);
    if (!wc) throw new Error(`no web contents at ${target}`);
    let held = false;
    const event = {
      preventDefault: () => {
        held = true;
      },
    };
    wc.emit('before-input-event', event, { type: 'keyDown', key: 'a', code: 'KeyA' });
    return held;
  }, url);

// Press Mod+<digit> natively on the web contents at `url` (macOS: Command) and
// wait until the app's own key handling has seen it. Listeners run in order, so
// once this one has, the app's handlers registered before it have run too.
const pressTabDigit = (app: ElectronApplication, url: string, digit: string): Promise<void> =>
  app.evaluate(
    ({ webContents }, { url: target, digit: key }) =>
      new Promise<void>((resolve) => {
        const wc = webContents.getAllWebContents().find((w) => w.getURL().includes(target));
        if (!wc) throw new Error(`no web contents at ${target}`);
        const seen = (_event: Electron.Event, input: Electron.Input): void => {
          if (input.type !== 'keyDown' || input.key !== key) return;
          wc.off('before-input-event', seen);
          resolve();
        };
        wc.on('before-input-event', seen);
        const modifiers: Array<'meta'> = ['meta'];
        wc.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers });
        wc.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers });
      }),
    { url, digit }
  );

const activeTabUrl = async (shell: Page): Promise<string | undefined> => {
  const { tabs, activeId } = await callShell<{
    tabs: Array<{ id: string; url: string }>;
    activeId: string | null;
  }>(shell, 'getTabs');
  return tabs.find((t) => t.id === activeId)?.url;
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
      return Boolean(wc) && focused[focused.length - 1] === wc!.id;
    },
    { mark, url }
  );

// URL of the topmost view in the main window: what pointer input lands on.
const topmostView = (app: ElectronApplication): Promise<string> =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0);
    const views = win?.contentView.children ?? [];
    const top = views[views.length - 1] as { webContents?: { getURL(): string } } | undefined;
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
      return yc[m]!(...a);
    },
    { m: method, a: args }
  ) as Promise<T>;

// How many URLs the app has loaded into a web contents so far; pass it to
// loadsSince.
const loadMark = (app: ElectronApplication): Promise<number> =>
  app.evaluate(() => ((globalThis as Record<string, unknown>).__loads as string[]).length);

const loadsSince = (app: ElectronApplication, mark: number): Promise<string[]> =>
  app.evaluate(
    (_electron, from) => ((globalThis as Record<string, unknown>).__loads as string[]).slice(from),
    mark
  );

// The same, for pages from `origin` only: not the app's own bundled pages.
const pimsLoadsSince = async (
  app: ElectronApplication,
  mark: number,
  origin: string
): Promise<string[]> => (await loadsSince(app, mark)).filter((url) => url.startsWith(origin));

// Run the recorded global shortcuts (all of them, or the one for
// `accelerator`) as the OS does when the chord is pressed. Returns how many ran.
const fireShortcuts = (app: ElectronApplication, accelerator?: string): Promise<number> =>
  app.evaluate((_electron, only) => {
    const shortcuts = (globalThis as Record<string, unknown>).__shortcuts as Map<
      string,
      () => void
    >;
    let fired = 0;
    for (const [chord, callback] of shortcuts) {
      if (only && chord !== only) continue;
      callback();
      fired++;
    }
    return fired;
  }, accelerator);

type WindowState = {
  id: number;
  title: string;
  // The workspace window: the one with the tab bar, tabs and lock views in it.
  workspace: boolean;
  visible: boolean;
  minimized: boolean;
};

const windowStates = (app: ElectronApplication): Promise<WindowState[]> =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      id: w.id,
      title: w.getTitle(),
      workspace: w.contentView.children.length > 0,
      visible: w.isVisible(),
      minimized: w.isMinimized(),
    }))
  );

const otherWindows = async (app: ElectronApplication): Promise<WindowState[]> =>
  (await windowStates(app)).filter((w) => !w.workspace);

// The views in the workspace window, top last, and whether each is shown.
const workspaceViews = (
  app: ElectronApplication
): Promise<Array<{ url: string; visible: boolean }>> =>
  app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0);
    return (win?.contentView.children ?? []).map((v) => ({
      url: (v as { webContents?: { getURL(): string } }).webContents?.getURL() ?? '',
      visible: v.getVisible(),
    }));
  });

// Run `script` in the page at `url`, as that page would.
const inPage = (app: ElectronApplication, url: string, script: string): Promise<void> =>
  app.evaluate(
    async ({ webContents }, { url: target, script: code }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL() === target);
      if (!wc) throw new Error(`no web contents at ${target}`);
      await wc.executeJavaScript(`void (() => { ${code}; })()`, true);
    },
    { url, script }
  );

// Reload the workspace window's own page and wait for it to finish: the load
// that picks up a deep link which was waiting for the window.
const reloadWorkspacePage = (app: ElectronApplication): Promise<void> =>
  app.evaluate(
    ({ BrowserWindow }) =>
      new Promise<void>((resolve) => {
        const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0);
        win!.webContents.once('did-finish-load', () => resolve());
        win!.webContents.reload();
      })
  );

// Open one window of every kind the app has besides the workspace: a pinned
// reference window, Preferences, the document vault, a patient window, a
// detached tab, and a popup a PIMS page opens.
const openOtherWindows = async (
  app: ElectronApplication,
  shell: Page,
  origin: string,
  tabUrl: string
): Promise<void> => {
  await callShell(shell, 'executeCommand', 'pin-current');
  await clickMenuItem(app, 'Preferences…');
  await clickMenuItem(app, 'Document Vault Browser…');
  expect((await callShell<{ ok: boolean }>(shell, 'openPatientWindow', 'p-1', 'Rex')).ok).toBe(
    true
  );
  const tab = await callShell<{ ok: boolean; id: string }>(shell, 'newTab', `${origin}/detached`);
  expect((await callShell<{ ok: boolean }>(shell, 'detachTab', tab.id)).ok).toBe(true);
  await inPage(app, tabUrl, `window.open(${JSON.stringify(`${origin}/popup`)})`);
  await expect.poll(async () => (await otherWindows(app)).length).toBe(6);
};

// Open two patient pages side by side, one in the active tab and one in the
// split pane.
const openSplitView = async (app: ElectronApplication, shell: Page, origin: string) => {
  const rex = `${origin}/patient-rex`;
  const bella = `${origin}/patient-bella`;
  const bellaTab = await callShell<{ ok: boolean; id: string }>(shell, 'newTab', bella);
  expect((await callShell<{ ok: boolean }>(shell, 'newTab', rex)).ok).toBe(true);
  expect((await callShell<{ ok: boolean }>(shell, 'setSplitTab', bellaTab.id)).ok).toBe(true);
  await expect.poll(() => keysReceived(app, bella)).toBe(0);
  await expect.poll(() => keysReceived(app, rex)).toBe(0);
  expect(await activeTabUrl(shell)).toBe(rex);
};

// The ids of every web contents showing a page from `origin`, in any window.
const pimsContents = (app: ElectronApplication, origin: string): Promise<number[]> =>
  app.evaluate(
    ({ webContents }, from) =>
      webContents
        .getAllWebContents()
        .filter((w) => w.getURL().startsWith(from))
        .map((w) => w.id),
    origin
  );

// Which of the web contents `ids` still exist.
const stillAlive = (app: ElectronApplication, ids: number[]): Promise<number[]> =>
  app.evaluate(
    ({ webContents }, all) => all.filter((id) => webContents.fromId(id) !== undefined),
    ids
  );

type Uncovered = {
  // The document the workspace window's own page had committed.
  page: string;
  // The web contents of every other view in the window.
  views: number[];
};

// From now on, note what the workspace window holds each time the lock page is
// taken out of it; read with uncovered(). Layout passes take it out and put it
// back on top too, so the last note is the one the lock coming down left, and
// the ones before it show what each layout pass on the way saw.
const recordUncovering = (app: ElectronApplication): Promise<void> =>
  app.evaluate(({ BrowserWindow }, lockPage) => {
    const notes: Uncovered[] = [];
    (globalThis as Record<string, unknown>).__uncovered = notes;
    const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0)!;
    const surface = win.contentView;
    const contentsOf = (view: Electron.View) =>
      (view as unknown as { webContents?: Electron.WebContents }).webContents;
    const removeChildView = surface.removeChildView.bind(surface);
    surface.removeChildView = (view) => {
      if (contentsOf(view)?.getURL().includes(lockPage)) {
        notes.push({
          page: win.webContents.mainFrame.url,
          views: surface.children
            .filter((child) => child !== view)
            .map((child) => {
              const wc = contentsOf(child);
              return wc && !wc.isDestroyed() ? wc.id : -1;
            }),
        });
      }
      removeChildView(view);
    };
  }, LOCK_PAGE);

const uncovered = (app: ElectronApplication): Promise<Uncovered[]> =>
  app.evaluate(() => (globalThis as Record<string, unknown>).__uncovered as Uncovered[]);

// Cancel the pending Touch ID prompt, then press the lock page's other button,
// and wait for the lock page to go.
const signOutFromLock = async (app: ElectronApplication, lockPage: Page): Promise<void> => {
  await answerTouchId(app, false);
  await expect
    .poll(() => lockPage.evaluate(() => document.getElementById('lockStatus')?.textContent))
    .toBe('Could not verify. Try again.');
  await lockPage.click('#usePassword');
  await expect.poll(() => app.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
};

// The local API writes its bearer token once it is listening.
const localApiNavigate = async (profileDir: string, url: string): Promise<number> => {
  const tokenFile = path.join(profileDir, 'local-api-token');
  await expect.poll(() => fs.existsSync(tokenFile)).toBe(true);
  const res = await fetch('http://127.0.0.1:18799/api/navigate', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${fs.readFileSync(tokenFile, 'utf8')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
  return res.status;
};

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

    // Everything under the lock page is hidden, not just covered.
    const views = await workspaceViews(app);
    expect(views.length).toBeGreaterThan(2);
    expect(views[views.length - 1]).toEqual({
      url: expect.stringContaining(LOCK_PAGE),
      visible: true,
    });
    expect(views.slice(0, -1).filter((v) => v.visible)).toEqual([]);

    // A keystroke aimed at the tab underneath never arrives.
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(0);

    // A tab opened during the lock is held too, and is hidden under the overlay
    // from the start.
    const openedUrl = `${server.origin}/opened`;
    const opened = await callShell<{ ok: boolean }>(shell, 'newTab', openedUrl);
    expect(opened.ok).toBe(true);
    await expect.poll(() => keysReceived(app!, openedUrl)).toBe(0);
    expect(await keyHeld(app, openedUrl)).toBe(true);
    expect(await topmostView(app)).toContain(LOCK_PAGE);
    expect((await workspaceViews(app)).find((v) => v.url === openedUrl)?.visible).toBe(false);

    // So is a tab switched to during the lock.
    const tabs = await callShell<{ tabs: Array<{ id: string; url: string }> }>(shell, 'getTabs');
    const first = tabs.tabs.find((t) => t.url === firstTab);
    expect((await callShell<{ ok: boolean }>(shell, 'activateTab', first!.id)).ok).toBe(true);
    // Switching tabs re-attaches the view, so its pointer path starts over.
    await waitForPointerInput(app, firstTab);
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
      const win = BrowserWindow.getAllWindows()[0]!;
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

    // A lock page whose renderer dies is replaced by a new one, on top and
    // focused, and the tab is still held. The page is told its renderer is gone
    // rather than having it killed: once any renderer has really crashed, the
    // app no longer exits on quit, and the next test's launch is left behind
    // macOS's "reopen windows?" prompt.
    const lockPages = () =>
      app!.evaluate(
        ({ webContents }, page) =>
          webContents
            .getAllWebContents()
            .filter((w) => w.getURL().includes(page))
            .map((w) => w.id),
        LOCK_PAGE
      );
    const [crashed] = await lockPages();
    const beforeCrash = await focusMark(app);
    await app.evaluate(({ webContents }, id) => {
      webContents.fromId(id)!.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    }, crashed!);
    await expect.poll(lockPages).toEqual([expect.any(Number)]);
    expect(await lockPages()).not.toEqual([crashed]);
    expect(await topmostView(app)).toContain(LOCK_PAGE);
    expect(await focusedSince(app, beforeCrash, LOCK_PAGE)).toBe(true);
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(0);

    // Unlock: the overlay goes, the active tab has focus and takes keys again,
    // and everything the lock hid is shown again.
    const beforeUnlock = await focusMark(app);
    await unlockWithTouchId(app);
    await expect.poll(() => app!.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
    expect(await focusedSince(app, beforeUnlock, firstTab)).toBe(true);
    await pressKey(app, firstTab, 'A');
    expect(await keysReceived(app, firstTab)).toBe(1);
    expect((await workspaceViews(app)).filter((v) => !v.visible)).toEqual([]);
  });

  test('every other window is hidden while locked, and comes back on unlock', async () => {
    test.setTimeout(150_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, {
      startPath: '/dashboard',
    });
    app = launched.app;
    const { shell } = launched;
    const tabUrl = `${server.origin}/dashboard`;
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    await openOtherWindows(app, shell, server.origin, tabUrl);
    // One of them is minimized to the Dock.
    const vaultId = (await otherWindows(app)).find((w) => w.title.startsWith('Document Vault'))!.id;
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)!.minimize(), vaultId);
    await expect
      .poll(async () => (await otherWindows(app!)).find((w) => w.id === vaultId)?.minimized)
      .toBe(true);
    // And one made but not shown yet, as the command palette is until it is ready.
    const neverShown = await app.evaluate(
      ({ BrowserWindow }) => new BrowserWindow({ show: false, title: 'not shown yet' }).id
    );

    await waitForLock(app);
    const shown = async () => (await otherWindows(app!)).filter((w) => w.visible);
    expect(await shown()).toEqual([]);
    // The workspace window stays up, under the lock.
    expect((await windowStates(app)).find((w) => w.workspace)?.visible).toBe(true);
    // Nor does restoring the minimized one from the Dock bring it back.
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)!.restore(), vaultId);
    await expect.poll(shown).toEqual([]);
    // Nor the app bringing any of them forward, whether or not the window then
    // tells anyone it is showing (it does not while the display sleeps).
    await app.evaluate(({ BrowserWindow }, skip) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.contentView.children.length > 0 || win.id === skip) continue;
        win.show();
        win.showInactive();
        win.focus();
        win.restore();
      }
    }, neverShown);
    expect(await shown()).toEqual([]);

    // One opened during the lock is hidden at once, whether the app opens it or
    // a page does, and so is one first shown during the lock.
    expect((await callShell<{ ok: boolean }>(shell, 'openPatientWindow', 'p-2', 'Bella')).ok).toBe(
      true
    );
    await inPage(app, tabUrl, `window.open(${JSON.stringify(`${server.origin}/popup-2`)})`);
    await app.evaluate(({ BrowserWindow }) =>
      new BrowserWindow({ show: false, title: 'shown during the lock' }).show()
    );
    await expect.poll(async () => (await otherWindows(app!)).length).toBe(10);
    await expect.poll(shown).toEqual([]);

    // Unlock: every window is back as it was, the minimized one minimized and
    // the one never shown still not shown.
    await unlockWithTouchId(app);
    await expect.poll(() => app!.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
    await expect
      .poll(async () =>
        (await otherWindows(app!)).map((w) => {
          if (w.id === vaultId) return w.minimized;
          return w.id === neverShown ? !w.visible : w.visible;
        })
      )
      .toEqual(Array(10).fill(true));
  });

  test('shortcuts and deep links do not reach the workspace while locked', async () => {
    test.setTimeout(120_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, {
      startPath: '/dashboard',
      env: { YC_DESKTOP_LOCAL_API: '1' },
    });
    app = launched.app;
    const { shell } = launched;
    const tabUrl = `${server.origin}/dashboard`;
    const secondUrl = `${server.origin}/second`;
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    // A second tab, so Mod+2 has somewhere to go; the first is active again.
    const second = await callShell<{ ok: boolean }>(shell, 'newTab', secondUrl);
    expect(second.ok).toBe(true);
    await expect.poll(() => keysReceived(app!, secondUrl)).toBe(0);
    const { tabs } = await callShell<{ tabs: Array<{ id: string; url: string }> }>(
      shell,
      'getTabs'
    );
    const first = tabs.find((t) => t.url === tabUrl)!;
    expect((await callShell<{ ok: boolean }>(shell, 'activateTab', first.id)).ok).toBe(true);
    // The global shortcuts are taken while one of the app's windows has focus.
    // A test-launched app never gets focus, so hand it the event it would get.
    await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.contentView.children.length > 0);
      electronApp.emit('browser-window-focus', {}, win);
    });

    await waitForLock(app);
    const windows = () =>
      app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    const windowsBefore = await windows();
    const tabsBefore = await tabCount(shell);
    const mark = await loadMark(app);

    // Every global shortcut, run as the OS runs it on its chord: no palette,
    // no tab, no navigation - not even one saved for after unlock.
    expect(await fireShortcuts(app)).toBe(SHORTCUTS.length);
    expect(await windows()).toBe(windowsBefore);
    expect(await tabCount(shell)).toBe(tabsBefore);
    expect(await loadsSince(app, mark)).toEqual([]);

    // Nor does Mod+2, which the lock page (focused, and exempt from the key
    // hold) receives like any other key.
    await pressTabDigit(app, LOCK_PAGE, '2');
    expect(await activeTabUrl(shell)).toBe(tabUrl);

    // Deep links wait: a macOS open-url, a second launch (how a Windows Jump
    // List task arrives), and the local API.
    await app.evaluate(({ app: electronApp }) => {
      electronApp.emit(
        'open-url',
        { preventDefault: () => undefined },
        'yosemitecrew://appointments/new'
      );
      electronApp.emit('second-instance', {}, ['electron', 'yosemitecrew://finance'], '/');
    });
    expect(await localApiNavigate(profileDir, 'yosemitecrew://chat')).toBe(200);
    // So does one the window's own page picks up when it finishes loading.
    await reloadWorkspacePage(app);
    expect(await loadsSince(app, mark)).toEqual([]);
    await pressKey(app, tabUrl, 'A');
    expect(await keysReceived(app, tabUrl)).toBe(0);

    // Unlock: the latest deep link opens, and nothing else.
    await unlockWithTouchId(app);
    await expect.poll(() => app!.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
    await expect.poll(() => loadsSince(app!, mark)).toEqual([`${server.origin}/chat`]);

    // The shortcuts work again, Mod+2 included.
    const appointments = SHORTCUTS.find((s) => s.id === 'appointments')!.accelerator;
    expect(await fireShortcuts(app, appointments)).toBe(1);
    expect(await loadsSince(app, mark)).toEqual([
      `${server.origin}/chat`,
      `${server.origin}/appointments`,
    ]);
    await expect.poll(() => keysReceived(app!, `${server.origin}/appointments`)).toBe(0);
    await pressTabDigit(app, `${server.origin}/appointments`, '2');
    expect(await activeTabUrl(shell)).toBe(secondUrl);
  });

  test('a lock that ends in sign-out leaves nothing of the old session behind', async () => {
    test.setTimeout(150_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, {
      startPath: '/dashboard',
    });
    app = launched.app;
    const { shell } = launched;
    const tabUrl = `${server.origin}/dashboard`;
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    await openOtherWindows(app, shell, server.origin, tabUrl);
    await openSplitView(app, shell, server.origin);

    const lockPage = await waitForLock(app);
    expect((await callShell<{ ok: boolean }>(shell, 'openPatientWindow', 'p-2', 'Bella')).ok).toBe(
      true
    );
    const mark = await loadMark(app);
    await app.evaluate(({ app: electronApp }) => {
      electronApp.emit(
        'open-url',
        { preventDefault: () => undefined },
        'yosemitecrew://appointments/new'
      );
    });
    // Every page of the session: three tabs (one in the split pane), a pinned
    // page, two patient windows, a detached tab and a popup.
    await expect.poll(async () => (await pimsContents(app!, server.origin)).length).toBe(8);
    const oldPages = await pimsContents(app, server.origin);

    await recordUncovering(app);
    await signOutFromLock(app, lockPage);

    // When the lock came down, the window held only views made after the
    // sign-out, over the welcome page; nor was an old one left in it at any
    // layout pass on the way.
    const notes = await uncovered(app);
    expect(notes[notes.length - 1]).toEqual({
      page: expect.stringMatching(/welcome\.html$/),
      views: [expect.any(Number), expect.any(Number)],
    });
    expect(notes.flatMap((n) => n.views).filter((id) => oldPages.includes(id))).toEqual([]);
    // Every window but the workspace is closed, and every old page is gone.
    expect(await windowStates(app)).toEqual([expect.objectContaining({ workspace: true })]);
    await expect.poll(() => stillAlive(app!, oldPages)).toEqual([]);
    // One tab, on the start URL, with nothing to reopen and no split pane.
    const tabs = await callShell<{ tabs: Array<{ url: string }>; closedStack: unknown[] }>(
      shell,
      'getTabs'
    );
    expect(tabs.tabs.map((t) => t.url)).toEqual([tabUrl]);
    expect(tabs.closedStack).toEqual([]);
    await expect
      .poll(async () => (await workspaceViews(app!)).map((v) => v.visible))
      .toEqual([true, true]);
    // Nor are the old tabs saved for the next launch.
    const saved = fs.readFileSync(path.join(profileDir, 'tab-session.json'), 'utf8');
    expect(saved).not.toContain('patient-');
    // The sign-out's own loads, and not the link: nor does the link turn up on
    // the next load that would have picked it up.
    await reloadWorkspacePage(app);
    expect(await pimsLoadsSince(app, mark, server.origin)).toEqual([tabUrl]);
  });

  test('a sign-out from the lock replaces a page open outside the tabs first', async () => {
    test.setTimeout(120_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, { signIn: false });
    app = launched.app;
    // On the welcome screen, a deep link opens its page in the window itself.
    const record = `${server.origin}/patients/rex`;
    await app.evaluate(({ app: electronApp }) => {
      electronApp.emit(
        'open-url',
        { preventDefault: () => undefined },
        'yosemitecrew://patients/rex'
      );
    });
    await expect.poll(() => keysReceived(app!, record)).toBe(0);

    const lockPage = await waitForLock(app);
    await recordUncovering(app);
    await signOutFromLock(app, lockPage);
    const notes = await uncovered(app);
    expect(notes[notes.length - 1]).toEqual({
      page: expect.stringMatching(/welcome\.html$/),
      views: [expect.any(Number), expect.any(Number)],
    });
    expect(await pimsContents(app, record)).toEqual([]);
  });

  test('without the lock screen, the idle sign-out leaves nothing of the old session', async () => {
    test.setTimeout(120_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, {
      startPath: '/dashboard',
      biometric: false,
    });
    app = launched.app;
    const { shell } = launched;
    const tabUrl = `${server.origin}/dashboard`;
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    await openOtherWindows(app, shell, server.origin, tabUrl);
    await openSplitView(app, shell, server.origin);
    await expect.poll(async () => (await pimsContents(app!, server.origin)).length).toBe(7);
    const oldPages = await pimsContents(app, server.origin);
    const mark = await loadMark(app);

    await goIdle(app);
    await expect
      .poll(() => pimsLoadsSince(app!, mark, server.origin), {
        timeout: 45_000,
        message: 'the idle sign-out never ran',
      })
      .toEqual([tabUrl]);
    expect(await windowStates(app)).toEqual([expect.objectContaining({ workspace: true })]);
    await expect.poll(() => stillAlive(app!, oldPages)).toEqual([]);
    // The shell page is the window's own page, which the sign-out reloads: the
    // poll rides out that reload.
    await expect
      .poll(async () => {
        const { tabs } = await callShell<{ tabs: Array<{ url: string }> }>(shell, 'getTabs');
        return tabs.map((t) => t.url);
      })
      .toEqual([tabUrl]);
  });

  test('a lock that engages with no window open covers the window reopened from the Dock', async () => {
    test.setTimeout(150_000);
    server = await startPimsServer();
    const launched = await launchLockableApp(server.origin, profileDir, {
      startPath: '/dashboard',
    });
    app = launched.app;
    const { shell } = launched;
    const tabUrl = `${server.origin}/dashboard`;
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    // A pinned window stays open, so the app has a window - one the lock hides.
    // It pins a page of its own, so the tab is the only web contents at tabUrl.
    const pinnedUrl = `${server.origin}/pinned`;
    const toPin = await callShell<{ ok: boolean; id: string }>(shell, 'newTab', pinnedUrl);
    await expect.poll(() => keysReceived(app!, pinnedUrl)).toBe(0);
    await callShell(shell, 'executeCommand', 'pin-current');
    await expect.poll(async () => (await otherWindows(app!)).length).toBe(1);
    expect((await callShell<{ ok: boolean }>(shell, 'closeTab', toPin.id)).ok).toBe(true);

    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.contentView.children.length > 0)
        ?.close()
    );
    await expect.poll(async () => (await windowStates(app!)).length).toBe(1);
    // With no window to put it in, the lock shows as its Touch ID prompt.
    await goIdle(app);
    await expect
      .poll(
        () => app!.evaluate(() => ((globalThis as Record<string, unknown>).__touch as []).length),
        {
          timeout: 45_000,
          message: 'the idle lock never engaged',
        }
      )
      .toBe(1);
    expect((await otherWindows(app))[0]).toEqual(
      expect.objectContaining({ visible: false, minimized: false })
    );

    // Clicking the Dock icon reopens the workspace window, under the lock.
    const beforeReopen = await focusMark(app);
    await app.evaluate(({ app: electronApp }) => electronApp.emit('activate'));
    await expect
      .poll(() => topmostView(app!), { message: 'the reopened window is not under the lock' })
      .toContain(LOCK_PAGE);
    expect(await focusedSince(app, beforeReopen, LOCK_PAGE)).toBe(true);
    await expect.poll(() => keysReceived(app!, tabUrl)).toBe(0);
    // This tab was first attached under the lock, so it has never been painted
    // and takes no pointer input for pressKey's marker: check the hold itself.
    expect(await keyHeld(app, tabUrl)).toBe(true);
    await expect
      .poll(async () => (await workspaceViews(app!)).map((v) => v.visible))
      .toEqual([false, false, true]);

    await unlockWithTouchId(app);
    await expect.poll(() => app!.windows().some((p) => p.url().includes(LOCK_PAGE))).toBe(false);
    await expect.poll(async () => (await otherWindows(app!))[0]?.visible).toBe(true);
    await waitForPointerInput(app, tabUrl);
    await pressKey(app, tabUrl, 'A');
    expect(await keysReceived(app, tabUrl)).toBe(1);
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
      const launched = await launchLockableApp(server.origin, profileDir, { startPath });
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
            const win = BrowserWindow.getAllWindows()[0]!;
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
