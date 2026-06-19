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
    if (url.pathname === '/signin') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html('Sign In', '<h1>Sign In</h1>'));
      return;
    }
    if (url.pathname === '/download') {
      const format = url.searchParams.get('format') || 'text';
      if (format === 'binary') {
        const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        res.setHeader('content-type', 'image/jpeg');
        res.setHeader('content-disposition', 'attachment; filename="photo.jpg"');
        res.end(buf);
      } else {
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.setHeader('content-disposition', 'attachment; filename="report.txt"');
        res.end('This is a text report.');
      }
      return;
    }
    res.statusCode = 404;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html('Not Found', '<h1>Not Found</h1>'));
  });

const launchApp = async (pimsOrigin: string, userDataDir?: string) => {
  const profileDir = userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yc-e2e-vault-'));
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

const triggerDownload = async (page: Page, origin: string, format: string): Promise<void> => {
  await page.evaluate(
    ({ o, f }: { o: string; f: string }) => {
      const a = document.createElement('a');
      a.href = `${o}/download?format=${f}`;
      a.download = f === 'binary' ? 'photo.jpg' : 'report.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    { o: origin, f: format }
  );
};

test.describe('document-vault E2E', () => {
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

  test('text download updates vault manifest', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await triggerDownload(page, pimsServer.origin, 'text');
    await page.waitForTimeout(1000);

    const response = await evaluateYcDesktop<{
      ok: boolean;
      documents: { filename: string }[];
    }>(page, 'vaultList');
    expect(response.ok).toBe(true);
    expect(response.documents.some((d) => d.filename === 'report.txt')).toBe(true);
  });

  test('binary download stores content as Buffer in vault', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await triggerDownload(page, pimsServer.origin, 'binary');
    await page.waitForTimeout(1000);

    const listRes = await evaluateYcDesktop<{
      ok: boolean;
      documents: { id: string; filename: string }[];
    }>(page, 'vaultList');
    expect(listRes.ok).toBe(true);
    expect(listRes.documents.length).toBeGreaterThanOrEqual(1);

    const binDoc = listRes.documents.find((d) => d.filename === 'photo.jpg');
    expect(binDoc).toBeTruthy();

    const getRes = await evaluateYcDesktop<{ ok: boolean; content: number[] }>(
      page,
      'vaultGet',
      binDoc!.id
    );
    expect(getRes.ok).toBe(true);
    expect(getRes.content).toBeTruthy();
    const content = new Uint8Array(getRes.content);
    expect(content[0]).toBe(0xff);
    expect(content[1]).toBe(0xd8);
  });

  test('download 3, list 3, delete 1, list 2', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    for (let i = 0; i < 3; i++) {
      await triggerDownload(page, pimsServer.origin, 'text');
      await page.waitForTimeout(500);
    }

    const listRes1 = await evaluateYcDesktop<{
      ok: boolean;
      documents: { id: string }[];
    }>(page, 'vaultList');
    expect(listRes1.ok).toBe(true);
    expect(listRes1.documents.length).toBe(3);

    const deleteRes = await evaluateYcDesktop<{ ok: boolean }>(
      page,
      'vaultDelete',
      listRes1.documents[0].id
    );
    expect(deleteRes.ok).toBe(true);

    const listRes2 = await evaluateYcDesktop<{
      ok: boolean;
      documents: unknown[];
    }>(page, 'vaultList');
    expect(listRes2.ok).toBe(true);
    expect(listRes2.documents).toHaveLength(2);
  });

  test('vault persists across app relaunch', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    await triggerDownload(page, pimsServer.origin, 'text');
    await page.waitForTimeout(500);

    const listRes1 = await evaluateYcDesktop<{
      ok: boolean;
      documents: unknown[];
    }>(page, 'vaultList');
    expect(listRes1.ok).toBe(true);
    expect(listRes1.documents.length).toBe(1);

    await app?.close();
    app = undefined;

    const relaunched = await launchApp(pimsServer.origin, userDataDir);
    app = relaunched.app;
    page = relaunched.page;

    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await page.waitForTimeout(500);

    const listRes2 = await evaluateYcDesktop<{
      ok: boolean;
      documents: unknown[];
    }>(page, 'vaultList');
    expect(listRes2.ok).toBe(true);
    expect(listRes2.documents.length).toBe(1);
  });

  test('vaultSave from renderer then vaultGet returns content', async () => {
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

    const content = Buffer.from('hello from renderer').toString('base64');
    const saveRes = await evaluateYcDesktop<{
      ok: boolean;
      document: { id: string };
    }>(page, 'vaultSave', 'from-renderer.txt', content, 'text/plain');
    expect(saveRes.ok).toBe(true);
    expect(saveRes.document).toBeTruthy();

    const getRes = await evaluateYcDesktop<{
      ok: boolean;
      document: { filename: string };
      content: number[];
    }>(page, 'vaultGet', saveRes.document.id);
    expect(getRes.ok).toBe(true);
    expect(getRes.document.filename).toBe('from-renderer.txt');
  });
});
