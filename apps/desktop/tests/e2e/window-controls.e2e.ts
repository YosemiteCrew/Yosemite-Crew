import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { openPimsTab } from './welcome';

// The title bar the app draws itself has to behave like a native one: the
// middle caption button says Restore while the window is maximised, a
// double-click on the empty area toggles maximise, and dragging a maximised
// window restores it under the pointer instead of doing nothing (issue #3293).
//
// These need the real window: maximise state lives in the main process, and the
// tab bar is a WebContentsView that is only told about it over IPC.

const APP_ROOT = path.resolve(__dirname, '..', '..');
const ELECTRON_EXECUTABLE = electronPath as unknown as string;

const startPimsServer = async (): Promise<{ origin: string; close: () => Promise<void> }> => {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      '<!doctype html><html><head><title>PIMS</title></head><body><h1>PIMS</h1></body></html>'
    );
  });
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

const isMaximized = (app: ElectronApplication): Promise<boolean> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized());

const mainWindowBounds = (
  app: ElectronApplication
): Promise<{ x: number; y: number; width: number; height: number }> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());

const setMaximized = (app: ElectronApplication, wanted: boolean): Promise<void> =>
  app.evaluate(({ BrowserWindow }, want) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    if (want) win.maximize();
    else win.unmaximize();
  }, wanted);

// The tab bar is a WebContentsView, so it is not `firstWindow()`; find it by URL.
const tabBarPage = (app: ElectronApplication): Page => {
  const page = app.windows().find((candidate) => candidate.url().includes('tabbar.html'));
  if (!page) {
    throw new Error(
      `no tab bar page; open pages: ${app
        .windows()
        .map((w) => w.url())
        .join(' | ')}`
    );
  }
  return page;
};

test.describe('window controls', () => {
  let app: ElectronApplication;
  let server: { origin: string; close: () => Promise<void> };

  test.beforeEach(async () => {
    server = await startPimsServer();
    app = await electron.launch({
      executablePath: ELECTRON_EXECUTABLE,
      args: [APP_ROOT],
      env: {
        ...process.env,
        YC_DESKTOP_START_URL: `${server.origin}/signin`,
        YC_DESKTOP_ALLOWED_ORIGINS: server.origin,
        YC_DESKTOP_DISABLE_UPDATES: '1',
        YC_DESKTOP_USER_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-window-')),
      },
    });
    await openPimsTab(app, server.origin);
    // A maximised window from a restored profile would make the first
    // assertion below pass for the wrong reason.
    await setMaximized(app, false);
  });

  test.afterEach(async () => {
    await app.close();
    await server.close();
  });

  test('the tab bar is told when the window is maximised and when it is restored', async () => {
    test.skip(
      process.platform === 'darwin',
      'macOS hides self-drawn caption; onWindowMaximizedChanged only wired when shown'
    );
    const tabBar = tabBarPage(app);
    await tabBar.evaluate(() => {
      const scope = globalThis as unknown as {
        __maximizedPushes?: boolean[];
        ycDesktop?: { onWindowMaximizedChanged?: (cb: (v: boolean) => void) => () => void };
      };
      const pushes: boolean[] = [];
      scope.__maximizedPushes = pushes;
      const subscribe = scope.ycDesktop?.onWindowMaximizedChanged;
      if (!subscribe) throw new Error('preload does not expose onWindowMaximizedChanged');
      subscribe((value) => pushes.push(value));
    });
    const pushes = (): Promise<boolean[]> =>
      tabBar.evaluate(
        () => (globalThis as unknown as { __maximizedPushes: boolean[] }).__maximizedPushes
      );

    await setMaximized(app, true);
    await expect.poll(pushes).toEqual([true]);

    await setMaximized(app, false);
    await expect.poll(pushes).toEqual([true, false]);
  });

  // macOS draws native traffic lights instead, so the tab bar keeps its own
  // caption buttons hidden there and there is no label to read. The Windows leg
  // of this matrix is what covers it.
  test('the caption button offers Restore while the window is maximised', async () => {
    test.skip(
      process.platform === 'darwin',
      'macOS uses native traffic lights, not caption buttons'
    );
    const maximizeButton = tabBarPage(app).locator('#win-max');
    await expect(maximizeButton).toHaveAttribute('aria-label', 'Maximize');

    await setMaximized(app, true);
    await expect(maximizeButton).toHaveAttribute('aria-label', 'Restore');
    await expect(maximizeButton).toHaveAttribute('title', 'Restore');

    await setMaximized(app, false);
    await expect(maximizeButton).toHaveAttribute('aria-label', 'Maximize');
  });

  test('double-clicking the empty title-bar area toggles maximise', async () => {
    test.skip(
      process.platform === 'darwin',
      'macOS uses native title bar; self-drawn caption/drag not shown'
    );
    const tabBar = tabBarPage(app);
    const spacer = tabBar.locator('.drag-spacer');
    await expect(spacer).toBeVisible();

    await spacer.dblclick();
    await expect.poll(() => isMaximized(app)).toBe(true);

    await spacer.dblclick();
    await expect.poll(() => isMaximized(app)).toBe(false);
  });

  test('dragging a maximised window restores it under the pointer', async () => {
    test.skip(
      process.platform === 'darwin',
      'macOS uses native title bar; self-drawn caption/drag not shown'
    );
    const tabBar = tabBarPage(app);
    const spacer = tabBar.locator('.drag-spacer');
    const box = await spacer.boundingBox();
    if (!box) throw new Error('the drag spacer has no box to grab');

    await setMaximized(app, true);
    await expect.poll(() => isMaximized(app)).toBe(true);
    const maximized = await mainWindowBounds(app);

    const [grabX, grabY] = [box.x + box.width / 2, box.y + box.height / 2];
    await tabBar.mouse.move(grabX, grabY);
    await tabBar.mouse.down();
    await tabBar.mouse.move(grabX + 40, grabY + 40, { steps: 8 });
    await tabBar.mouse.up();

    await expect.poll(() => isMaximized(app)).toBe(false);
    const restored = await mainWindowBounds(app);
    // Restored, not merely un-maximised in place: the window is narrower than
    // the screen it filled, so before this fix the drag was ignored entirely.
    expect(restored.width).toBeLessThan(maximized.width);
  });
});

// Welcome and What's new render in the main window's OWN contents, with no tab
// bar above them, so before this fix the window had no title bar at all while
// one was up: nothing to drag on macOS, and no caption buttons anywhere on
// Windows and Linux (issue #3291). This launches signed-out and stays on the
// welcome screen rather than driving into tab mode.
test.describe('the local pages title bar', () => {
  let app: ElectronApplication;
  let server: { origin: string; close: () => Promise<void> };
  let welcome: Page;

  test.beforeEach(async () => {
    server = await startPimsServer();
    app = await electron.launch({
      executablePath: ELECTRON_EXECUTABLE,
      args: [APP_ROOT],
      env: {
        ...process.env,
        YC_DESKTOP_START_URL: `${server.origin}/signin`,
        YC_DESKTOP_ALLOWED_ORIGINS: server.origin,
        YC_DESKTOP_DISABLE_UPDATES: '1',
        YC_DESKTOP_USER_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-welcome-')),
      },
    });
    welcome = await app.firstWindow();
    await welcome.waitForLoadState('domcontentloaded');
    await expect(welcome).toHaveURL(/welcome\.html$/);
  });

  test.afterEach(async () => {
    await app.close();
    await server.close();
  });

  test('the welcome screen carries a drag strip', async () => {
    const header = welcome.locator('.yc-window-header');
    await expect(header).toHaveCount(1);
    // The strip is what makes the window movable; without the drag region the
    // element would be decorative.
    await expect(header).toHaveCSS('-webkit-app-region', 'drag');
    const box = await header.boundingBox();
    expect(box?.height).toBe(40);
  });

  test('the strip keeps clear of the macOS traffic lights', async () => {
    test.skip(process.platform !== 'darwin', 'the traffic lights are macOS only');
    // The window draws them itself at x: 12; the inset is what stops the page
    // putting a caption button (or, on a future page, content) under them.
    await expect(welcome.locator('.yc-window-header')).toHaveCSS('padding-left', '78px');
    await expect(welcome.locator('.yc-window-btn')).toHaveCount(0);
  });

  test('Windows and Linux get minimise, maximise and close on the welcome screen', async () => {
    test.skip(process.platform === 'darwin', 'macOS draws its own traffic lights');
    await expect(welcome.locator('.yc-window-btn')).toHaveCount(3);
    for (const label of ['Minimize', 'Maximize', 'Close']) {
      await expect(welcome.getByRole('button', { name: label })).toHaveCount(1);
    }
  });

  test('the caption buttons are not part of the drag region, or they could not be clicked', async () => {
    test.skip(process.platform === 'darwin', 'macOS draws its own traffic lights');
    await expect(welcome.locator('.yc-window-caption')).toHaveCSS('-webkit-app-region', 'no-drag');
  });

  test('the maximise button minimises the window from the welcome screen', async () => {
    test.skip(process.platform === 'darwin', 'macOS draws its own traffic lights');
    await welcome.getByRole('button', { name: 'Minimize' }).click();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMinimized())
      )
      .toBe(true);
  });

  test('the middle button follows the window state, showing one glyph at a time', async () => {
    test.skip(process.platform === 'darwin', 'macOS draws its own traffic lights');
    const visibleGlyphs = (): Promise<string[]> =>
      welcome.evaluate(() =>
        Array.from(document.querySelectorAll('.yc-window-btn svg[data-glyph]'))
          .filter((glyph) => getComputedStyle(glyph).display !== 'none')
          .map((glyph) => (glyph as SVGElement).dataset.glyph as string)
      );

    // Restored: Maximize is drawn and Restore is not. `svg.hidden = …` is inert
    // - `hidden` is an HTMLElement property and an SVGElement has none - so
    //   before the attribute-driven fix BOTH were drawn, on top of each other.
    await expect.poll(visibleGlyphs).toEqual(['minimize', 'maximize', 'close']);
    await expect(welcome.getByRole('button', { name: 'Maximize' })).toHaveCount(1);

    await setMaximized(app, true);
    await expect.poll(visibleGlyphs).toEqual(['minimize', 'restore', 'close']);
    await expect(welcome.getByRole('button', { name: 'Restore' })).toHaveCount(1);

    await setMaximized(app, false);
    await expect.poll(visibleGlyphs).toEqual(['minimize', 'maximize', 'close']);
  });
});
