import { createPinWindowManager, pinWindowBounds } from '../src/ui/pin-window';

interface FakeWin {
  windowId: string;
  url: string;
  closed: boolean;
  focusCount: number;
}

const makeManager = (overrides: Partial<Parameters<typeof createPinWindowManager>[0]> = {}) => {
  const wins = new Map<string, FakeWin>();
  let n = 0;
  const deps = {
    createWindow: (url: string): string => {
      const windowId = `win-${++n}`;
      wins.set(windowId, { windowId, url, closed: false, focusCount: 0 });
      return windowId;
    },
    closeWindow: (windowId: string): boolean => {
      const w = wins.get(windowId);
      if (!w) return false;
      w.closed = true;
      return true;
    },
    focusWindow: (windowId: string): void => {
      const w = wins.get(windowId);
      if (w) w.focusCount += 1;
    },
    isPinnable: (url: string): boolean => url.startsWith('https://'),
    generateId: (): string => `pin-${n}`,
    ...overrides,
  };
  return { mgr: createPinWindowManager(deps), wins, deps };
};

describe('createPinWindowManager', () => {
  it('pins a pinnable URL, creating one window and listing it', () => {
    const { mgr, wins } = makeManager();
    const id = mgr.pin('https://app/dashboard', 'Dash');
    expect(id).not.toBeNull();
    expect(wins.size).toBe(1);
    expect(mgr.list()).toEqual([{ id, url: 'https://app/dashboard' }]);
    expect(mgr.has('https://app/dashboard')).toBe(true);
  });

  it('rejects a non-pinnable URL without creating a window', () => {
    const { mgr, wins } = makeManager();
    expect(mgr.pin('ftp://nope')).toBeNull();
    expect(mgr.pin('')).toBeNull();
    expect(wins.size).toBe(0);
    expect(mgr.has('ftp://nope')).toBe(false);
  });

  it('does not open a duplicate for the same URL — focuses the existing window', () => {
    const { mgr, wins } = makeManager();
    const first = mgr.pin('https://app/chart');
    const second = mgr.pin('https://app/chart');
    expect(second).toBe(first);
    expect(wins.size).toBe(1);
    const win = [...wins.values()][0];
    expect(win.focusCount).toBe(1);
  });

  it('closes a pin by id and reports unknown ids', () => {
    const { mgr, wins } = makeManager();
    const id = mgr.pin('https://app/x') as string;
    expect(mgr.close('missing')).toBe(false);
    expect(mgr.close(id)).toBe(true);
    expect([...wins.values()][0].closed).toBe(true);
    expect(mgr.list()).toEqual([]);
    expect(mgr.close(id)).toBe(false);
  });

  it('closeAll closes every pinned window and clears state', () => {
    const { mgr, wins } = makeManager();
    mgr.pin('https://app/a');
    mgr.pin('https://app/b');
    expect(wins.size).toBe(2);
    mgr.closeAll();
    expect([...wins.values()].every((w) => w.closed)).toBe(true);
    expect(mgr.list()).toEqual([]);
  });

  it('uses default id generator, http/https gate, and tolerates no focusWindow', () => {
    const created: string[] = [];
    const mgr = createPinWindowManager({
      createWindow: (url) => {
        created.push(url);
        return `w${created.length}`;
      },
      closeWindow: () => true,
    });
    expect(mgr.pin('http://app/one')).not.toBeNull();
    expect(mgr.pin('file:///etc/passwd')).toBeNull();
    // Re-pin the same URL with no focusWindow dep wired — must not throw.
    expect(() => mgr.pin('http://app/one')).not.toThrow();
    expect(created).toEqual(['http://app/one']);
  });
});

describe('pinWindowBounds', () => {
  it('anchors to the top-right of the work area with a margin', () => {
    const b = pinWindowBounds({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(b.width).toBe(440);
    expect(b.height).toBe(720);
    expect(b.x).toBe(1920 - 440 - 24);
    expect(b.y).toBe(24);
  });

  it('respects a non-zero display origin', () => {
    const b = pinWindowBounds({ x: 100, y: 50, width: 1000, height: 800 }, { width: 400, height: 600 });
    expect(b.x).toBe(100 + 1000 - 400 - 24);
    expect(b.y).toBe(50 + 24);
  });

  it('clamps the panel to the area when the requested size is too large', () => {
    const b = pinWindowBounds({ x: 0, y: 0, width: 300, height: 200 });
    expect(b.width).toBe(300);
    expect(b.height).toBe(200);
  });
});
