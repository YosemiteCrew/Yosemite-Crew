import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_BOUNDS,
  MIN_WIDTH,
  MIN_HEIGHT,
  normalizeWindowState,
  clampToVisibleDisplays,
  createWindowStateStore,
  manageWindow,
} from '../src/core/window-state';

describe('normalizeWindowState', () => {
  test('falls back to default bounds when state is missing or malformed', () => {
    expect(normalizeWindowState(null)).toEqual({
      width: DEFAULT_BOUNDS.width,
      height: DEFAULT_BOUNDS.height,
      isMaximized: false,
    });
    expect(normalizeWindowState({ width: 'nope', height: NaN } as never)).toEqual({
      width: DEFAULT_BOUNDS.width,
      height: DEFAULT_BOUNDS.height,
      isMaximized: false,
    });
  });

  test('clamps dimensions to the minimum window size', () => {
    const state = normalizeWindowState({ width: 200, height: 100 });
    expect(state.width).toBe(MIN_WIDTH);
    expect(state.height).toBe(MIN_HEIGHT);
  });

  test('preserves valid position and maximized flag', () => {
    expect(
      normalizeWindowState({
        width: 1600,
        height: 1000,
        x: 120,
        y: 64,
        isMaximized: true,
      })
    ).toEqual({
      width: 1600,
      height: 1000,
      x: 120,
      y: 64,
      isMaximized: true,
    });
  });

  test('drops position when only one coordinate is present', () => {
    const state = normalizeWindowState({ width: 1600, height: 1000, x: 120 });
    expect('x' in state).toBe(false);
    expect('y' in state).toBe(false);
  });

  test('preserves and clamps the persisted zoom level', () => {
    expect(normalizeWindowState({ zoomLevel: 1.5 }).zoomLevel).toBe(1.5);
    expect(normalizeWindowState({ zoomLevel: 99 }).zoomLevel).toBe(5);
    expect(normalizeWindowState({ zoomLevel: -99 }).zoomLevel).toBe(-5);
    expect('zoomLevel' in normalizeWindowState({})).toBe(false);
  });
});

describe('createWindowStateStore', () => {
  test('round-trips state through an injected filesystem', () => {
    const files = new Map<string, string>();
    const store = createWindowStateStore('/virtual/window-state.json', {
      readFileSync: ((p: string) => {
        if (!files.has(p)) throw new Error('ENOENT');
        return files.get(p);
      }) as never,
      writeFileSync: ((p: string, data: string) => files.set(p, data)) as never,
      mkdirSync: (() => undefined) as never,
    });

    expect(store.load()).toEqual({
      width: DEFAULT_BOUNDS.width,
      height: DEFAULT_BOUNDS.height,
      isMaximized: false,
    });

    expect(
      store.save({
        width: 1500,
        height: 900,
        x: 10,
        y: 20,
        isMaximized: false,
      })
    ).toBe(true);
    expect(store.load()).toEqual({
      width: 1500,
      height: 900,
      x: 10,
      y: 20,
      isMaximized: false,
    });
  });

  test('returns defaults when the file contains invalid JSON', () => {
    const store = createWindowStateStore('/virtual/bad.json', {
      readFileSync: (() => '{not json') as never,
      writeFileSync: (() => undefined) as never,
      mkdirSync: (() => undefined) as never,
    });

    expect(store.load()).toEqual({
      width: DEFAULT_BOUNDS.width,
      height: DEFAULT_BOUNDS.height,
      isMaximized: false,
    });
  });

  test('round-trips through the real filesystem (default deps)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-winstate-'));
    const file = path.join(dir, 'nested', 'window-state.json');
    const store = createWindowStateStore(file);

    expect(store.load()).toEqual({
      width: DEFAULT_BOUNDS.width,
      height: DEFAULT_BOUNDS.height,
      isMaximized: false,
    });
    expect(store.save({ width: 1480, height: 920, x: 3, y: 4, isMaximized: true })).toBe(true);
    expect(store.load()).toEqual({
      width: 1480,
      height: 920,
      x: 3,
      y: 4,
      isMaximized: true,
    });

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('save returns false when writing fails', () => {
    const store = createWindowStateStore('/virtual/x.json', {
      readFileSync: (() => '{}') as never,
      writeFileSync: (() => {
        throw new Error('EACCES');
      }) as never,
      mkdirSync: (() => undefined) as never,
    });
    expect(store.save({ width: 1500, height: 900 })).toBe(false);
  });
});

describe('manageWindow', () => {
  const makeWindow = (overrides: Record<string, unknown>) => {
    const listeners: Record<string, () => void> = {};
    const win = {
      on: (event: string, fn: () => void) => {
        listeners[event] = fn;
      },
      isDestroyed: () => false,
      isMaximized: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 1100, height: 800 }),
      webContents: { getZoomLevel: () => 0 },
      ...overrides,
    };
    return { win, listeners };
  };

  test('persists a snapshot (bounds + maximized + zoom) on close', () => {
    const saved: unknown[] = [];
    const { win, listeners } = makeWindow({
      isMaximized: () => true,
      getNormalBounds: () => ({ x: 5, y: 6, width: 1300, height: 850 }),
      webContents: { getZoomLevel: () => 1 },
    });

    manageWindow(win as never, { save: (s) => saved.push(s) });
    listeners.close();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({
      x: 5,
      y: 6,
      width: 1300,
      height: 850,
      isMaximized: true,
      zoomLevel: 1,
    });
  });

  test('debounces resize/move events before saving', () => {
    jest.useFakeTimers();
    try {
      const saved: Array<{ width: number }> = [];
      const { win, listeners } = makeWindow({});

      manageWindow(win as never, { save: (s) => saved.push(s as { width: number }) }, 400);
      listeners.resize();
      listeners.move();
      expect(saved).toHaveLength(0);
      jest.advanceTimersByTime(400);
      expect(saved).toHaveLength(1);
      expect(saved[0].width).toBe(1100);
    } finally {
      jest.useRealTimers();
    }
  });

  test('does not persist when the window is already destroyed', () => {
    const saved: unknown[] = [];
    const { win, listeners } = makeWindow({ isDestroyed: () => true });
    manageWindow(win as never, { save: (s) => saved.push(s) });
    listeners.close();
    expect(saved).toHaveLength(0);
  });

  test('tolerates a missing/throwing webContents zoom reader', () => {
    const saved: unknown[] = [];
    const { win, listeners } = makeWindow({
      getNormalBounds: () => ({ x: 1, y: 2, width: 1200, height: 800 }),
      webContents: {
        getZoomLevel: () => {
          throw new Error('no zoom');
        },
      },
    });
    manageWindow(win as never, { save: (s) => saved.push(s) });
    listeners.close();
    expect(saved[0]).toEqual({
      x: 1,
      y: 2,
      width: 1200,
      height: 800,
      isMaximized: false,
    });
  });
});

describe('clampToVisibleDisplays', () => {
  const primary = { workArea: { x: 0, y: 0, width: 1440, height: 900 } };

  it('keeps the position when it overlaps a display', () => {
    const state = {
      x: 100,
      y: 80,
      width: 1200,
      height: 800,
      isMaximized: false,
    };
    expect(clampToVisibleDisplays(state, [primary])).toEqual(state);
  });

  it('drops x/y when the window is entirely off every display', () => {
    const state = {
      x: 3000,
      y: 1500,
      width: 1200,
      height: 800,
      isMaximized: false,
    };
    const result = clampToVisibleDisplays(state, [primary]);
    expect(result.x).toBeUndefined();
    expect(result.y).toBeUndefined();
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
  });

  it('keeps the position when a second display covers it', () => {
    const secondary = {
      workArea: { x: 1440, y: 0, width: 1920, height: 1080 },
    };
    const state = {
      x: 2000,
      y: 200,
      width: 1200,
      height: 800,
      isMaximized: false,
    };
    expect(clampToVisibleDisplays(state, [primary, secondary])).toEqual(state);
  });

  it('returns the state unchanged when no position is set', () => {
    const state = { width: 1200, height: 800, isMaximized: false };
    expect(clampToVisibleDisplays(state, [primary])).toEqual(state);
  });
});
