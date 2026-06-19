import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateIpcRequest, isTrustedIpcSender, createIpcRegistry } from '../src/core/ipc';
import { getDesktopConfig } from '../src/core/navigation-policy';

const config = getDesktopConfig({});
const localRoot = path.join(__dirname, '..', 'build');
const localFileUrl = pathToFileURL(path.join(localRoot, 'offline.html')).href;

const sender = (url: string) => ({ senderFrame: { url } }) as never;

describe('IPC validation', () => {
  test('trusts PIMS pages and bundled local desktop pages', () => {
    expect(
      isTrustedIpcSender(sender('https://yosemitecrew.com/dashboard'), config, localRoot)
    ).toBe(true);
    expect(isTrustedIpcSender(sender(localFileUrl), config, localRoot)).toBe(true);
    expect(isTrustedIpcSender(sender('yosemitecrew-desktop://offline/'), config, localRoot)).toBe(
      true
    );
  });

  test('rejects external origins, external local files, internal assets, unknown channels, and unexpected args', () => {
    expect(
      validateIpcRequest(sender('https://example.com'), 'yc:reload', [], config, localRoot)
    ).toEqual({
      ok: false,
      reason: 'untrusted-sender',
    });
    expect(
      validateIpcRequest(sender('file:///tmp/offline.html'), 'yc:reload', [], config, localRoot)
    ).toEqual({
      ok: false,
      reason: 'untrusted-sender',
    });
    expect(
      validateIpcRequest(
        sender('yosemitecrew-desktop://resources/icon.png'),
        'yc:reload',
        [],
        config,
        localRoot
      )
    ).toEqual({ ok: false, reason: 'untrusted-sender' });
    expect(validateIpcRequest(sender(localFileUrl), 'bad', [], config, localRoot)).toEqual({
      ok: false,
      reason: 'unknown-channel',
    });
    expect(validateIpcRequest(sender(localFileUrl), 'yc:reload', ['x'], config, localRoot)).toEqual(
      {
        ok: false,
        reason: 'unexpected-args',
      }
    );
  });

  test('validates yc:get-palette-actions channel', () => {
    expect(
      validateIpcRequest(
        sender('https://yosemitecrew.com/dashboard'),
        'yc:get-palette-actions',
        [],
        config,
        localRoot
      )
    ).toEqual({ ok: true });
  });

  test('validates sync and local-data channels without arguments', () => {
    expect(
      validateIpcRequest(sender(localFileUrl), 'yc:get-sync-status', [], config, localRoot)
    ).toEqual({
      ok: true,
    });
    expect(validateIpcRequest(sender(localFileUrl), 'yc:sync-now', [], config, localRoot)).toEqual({
      ok: true,
    });
    expect(
      validateIpcRequest(sender(localFileUrl), 'yc:sync-now', ['bad'], config, localRoot)
    ).toEqual({
      ok: false,
      reason: 'unexpected-args',
    });
    expect(
      validateIpcRequest(sender(localFileUrl), 'yc:clear-local-data', [], config, localRoot)
    ).toEqual({
      ok: true,
    });
    expect(
      validateIpcRequest(sender(localFileUrl), 'yc:clear-local-data', ['bad'], config, localRoot)
    ).toEqual({
      ok: false,
      reason: 'unexpected-args',
    });
  });

  test('allows telehealth launch intents from trusted pages only', () => {
    expect(
      validateIpcRequest(
        sender('https://yosemitecrew.com/appointments'),
        'yc:start-telehealth',
        [{ appointmentId: 'appt-123' }],
        config,
        localRoot
      )
    ).toEqual({ ok: true });
    expect(
      validateIpcRequest(
        sender('https://example.com/appointments'),
        'yc:start-telehealth',
        [{ appointmentId: 'appt-123' }],
        config,
        localRoot
      )
    ).toEqual({ ok: false, reason: 'untrusted-sender' });
  });

  test('wraps handlers with validation and converts failures to safe responses', async () => {
    const registered: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    const warnings: Array<{ event: string }> = [];
    const errors: Array<{ event: string }> = [];
    const registry = createIpcRegistry({
      ipcMain: {
        handle: (channel: string, fn: never) => {
          registered[channel] = fn;
        },
      } as never,
      config,
      localFileRoot: localRoot,
      logger: {
        warn: (event: string) => warnings.push({ event }),
        error: (event: string) => errors.push({ event }),
      } as never,
    });

    registry.handle('yc:reload', async () => ({ ok: true }));
    await expect(registered['yc:reload'](sender(localFileUrl))).resolves.toEqual({ ok: true });
    await expect(registered['yc:reload'](sender(localFileUrl), 'bad')).resolves.toEqual({
      ok: false,
      error: 'unexpected-args',
    });
    expect(warnings[0].event).toBe('ipc_request_rejected');

    registry.handle('yc:open-in-browser', async () => {
      throw new Error('boom');
    });
    await expect(registered['yc:open-in-browser'](sender(localFileUrl))).resolves.toEqual({
      ok: false,
      error: 'handler-failed',
    });
    expect(errors[0].event).toBe('ipc_handler_failed');
  });
});
