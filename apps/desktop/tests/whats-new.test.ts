import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// The What's New page script is a plain browser IIFE loaded over file://, so it
// is run here against a minimal stand-in for the page and the preload bridge.
const source = fs.readFileSync(path.join(__dirname, '../src/pages/whats-new.js'), 'utf8');

// One macrotask turn: every promise the page chained has settled by then.
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const runPage = (bridge: Record<string, unknown>) => {
  const version = { textContent: '' };
  const button = { addEventListener: jest.fn() };
  const document = {
    getElementById: (id: string) => (id === 'version' ? version : button),
  };
  const context: Record<string, unknown> = { document, Promise };
  context.globalThis = context;
  context.ycDesktop = bridge;
  vm.runInNewContext(source, context);
  return { version };
};

describe("What's New page", () => {
  test('shows the app version and update channel', async () => {
    const { version } = runPage({
      getSettings: () => Promise.resolve({ ok: true, settings: { updateChannel: 'beta' } }),
      getAppVersion: () => Promise.resolve('1.2.3'),
      dismissWhatsNew: jest.fn(),
    });
    await settle();
    expect(version.textContent).toBe('Version 1.2.3 · Beta channel');
  });

  test('a failed version read leaves the line empty and nothing unhandled', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const { version } = runPage({
        getSettings: () => Promise.resolve({ ok: true, settings: {} }),
        getAppVersion: () => Promise.reject(new Error('bridge gone')),
        dismissWhatsNew: jest.fn(),
      });
      await settle();
      // A second turn gives Node the chance to report a rejection nobody handled.
      await settle();
      expect(version.textContent).toBe('');
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
