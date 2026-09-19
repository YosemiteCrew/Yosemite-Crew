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
