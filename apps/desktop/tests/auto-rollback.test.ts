import {
  readTracker,
  writeTracker,
  resetTracker,
  recordCrash,
  evaluateRollback,
  isBadCrash,
  MAX_CRASHES,
  CRASH_WINDOW_MS,
  type RollbackTracker,
} from '../src/lifecycle/auto-rollback';

const trackerPath = '/tmp/test-rollback-tracker.json';

const mem = { data: '' };
const memDeps = {
  readFileSync: () => mem.data,
  writeFileSync: (_path: string, data: string) => {
    mem.data = data;
  },
  mkdirSync: () => undefined,
  pathDirname: () => '/tmp',
};

const makeTracker = (overrides: Partial<RollbackTracker> = {}): RollbackTracker => ({
  currentVersion: '1.0.0',
  crashCount: 0,
  lastCrashTimestamp: 0,
  firstCrashTimestamp: 0,
  updatedAt: Date.now(),
  ...overrides,
});

beforeEach(() => {
  mem.data = '';
});

describe('pathDirname default', () => {
  test('extracts directory from absolute path', () => {
    let capturedDir = '';
    const deps = {
      writeFileSync: () => {
        capturedDir = 'called';
      },
      pathDirname: (p: string) => {
        const lastSlash = p.lastIndexOf('/');
        return lastSlash >= 0 ? p.slice(0, lastSlash) : '.';
      },
    };
    const tracker = makeTracker();
    writeTracker('/some/dir/tracker.json', tracker, deps);
    expect(capturedDir).toBe('called');
  });

  test('pathDirname returns . for path without slash', () => {
    let capturedDir = '';
    const deps = {
      writeFileSync: () => {
        /* noop */
      },
      mkdirSync: (dir: string) => {
        capturedDir = dir;
      },
      pathDirname: (p: string) => {
        const lastSlash = p.lastIndexOf('/');
        return lastSlash >= 0 ? p.slice(0, lastSlash) : '.';
      },
    };
    const tracker = makeTracker();
    writeTracker('tracker.json', tracker, deps);
    expect(capturedDir).toBe('.');
  });
});

describe('readTracker', () => {
  test('returns default when file does not exist', () => {
    const tracker = readTracker(trackerPath);
    expect(tracker.currentVersion).toBe('');
    expect(tracker.crashCount).toBe(0);
  });

  test('reads valid JSON', () => {
    mem.data = JSON.stringify(makeTracker({ currentVersion: '2.0.0', crashCount: 2 }));
    const tracker = readTracker(trackerPath, memDeps);
    expect(tracker.currentVersion).toBe('2.0.0');
    expect(tracker.crashCount).toBe(2);
  });

  test('handles corrupt JSON gracefully', () => {
    mem.data = 'not-json';
    const tracker = readTracker(trackerPath, {
      ...memDeps,
      readFileSync: () => 'not-json',
    });
    expect(tracker.currentVersion).toBe('');
    expect(tracker.crashCount).toBe(0);
  });

  test('falls back to defaults for fields with wrong types', () => {
    mem.data = JSON.stringify({
      currentVersion: 123,
      crashCount: 'abc',
      lastCrashTimestamp: 'bad',
      firstCrashTimestamp: null,
      updatedAt: undefined,
    });
    const tracker = readTracker(trackerPath, memDeps);
    expect(tracker.currentVersion).toBe('');
    expect(tracker.crashCount).toBe(0);
    expect(tracker.lastCrashTimestamp).toBe(0);
    expect(tracker.firstCrashTimestamp).toBe(0);
    expect(tracker.updatedAt).toBe(0);
  });
});

describe('writeTracker', () => {
  test('writes tracker data', () => {
    const tracker = makeTracker({ currentVersion: '1.0.0', crashCount: 1 });
    writeTracker('/tmp/test-tracker.json', tracker, memDeps);
    const parsed = JSON.parse(mem.data);
    expect(parsed.currentVersion).toBe('1.0.0');
    expect(parsed.crashCount).toBe(1);
  });

  test('does nothing when writeFileSync not provided', () => {
    const tracker = makeTracker({ currentVersion: '1.0.0' });
    expect(() => writeTracker('/tmp/t.json', tracker)).not.toThrow();
  });

  test('writes without mkdirSync when not provided', () => {
    const depsWithoutMkdir = { ...memDeps };
    delete (depsWithoutMkdir as { mkdirSync?: unknown }).mkdirSync;
    const tracker = makeTracker({ currentVersion: '1.0.0' });
    writeTracker('/tmp/test-tracker.json', tracker, depsWithoutMkdir);
    expect(JSON.parse(mem.data).currentVersion).toBe('1.0.0');
  });

  test('catches write errors gracefully', () => {
    const throwingDeps = {
      ...memDeps,
      writeFileSync: () => {
        throw new Error('disk full');
      },
    };
    const tracker = makeTracker();
    expect(() => writeTracker('/tmp/t.json', tracker, throwingDeps)).not.toThrow();
  });

  test('uses default pathDirname with absolute path', () => {
    let mkdirDir = '';
    const tracker = makeTracker();
    writeTracker('/tmp/foo/tracker.json', tracker, {
      writeFileSync: () => {
        /* noop */
      },
      mkdirSync: (dir: string) => {
        mkdirDir = dir;
      },
    });
    expect(mkdirDir).toBe('/tmp/foo');
  });

  test('uses default pathDirname with relative path (no slash)', () => {
    let mkdirDir = '';
    const tracker = makeTracker();
    writeTracker('tracker.json', tracker, {
      writeFileSync: () => {
        /* noop */
      },
      mkdirSync: (dir: string) => {
        mkdirDir = dir;
      },
    });
    expect(mkdirDir).toBe('.');
  });
});

describe('resetTracker', () => {
  test('creates fresh tracker with given version', () => {
    mem.data = '';
    const tracker = resetTracker(trackerPath, '3.0.0', memDeps);
    expect(tracker.currentVersion).toBe('3.0.0');
    expect(tracker.crashCount).toBe(0);
    const parsed = JSON.parse(mem.data);
    expect(parsed.currentVersion).toBe('3.0.0');
    expect(parsed.crashCount).toBe(0);
  });
});

describe('recordCrash', () => {
  test('records first crash for a new version', () => {
    const tracker = recordCrash(trackerPath, '2.0.0', memDeps);
    expect(tracker.currentVersion).toBe('2.0.0');
    expect(tracker.crashCount).toBe(1);
  });

  test('increments crash count within time window', () => {
    recordCrash(trackerPath, '1.0.0', memDeps);
    const tracker = recordCrash(trackerPath, '1.0.0', memDeps);
    expect(tracker.crashCount).toBe(2);
  });

  test('resets crash count when window expires', () => {
    const oldNow = Date.now() - CRASH_WINDOW_MS - 1000;
    mem.data = JSON.stringify(
      makeTracker({
        currentVersion: '1.0.0',
        crashCount: 3,
        lastCrashTimestamp: oldNow,
        firstCrashTimestamp: oldNow - 1000,
      })
    );
    const tracker = recordCrash(trackerPath, '1.0.0', {
      ...memDeps,
      readFileSync: () => mem.data,
    });
    expect(tracker.crashCount).toBe(1);
  });

  test('resets when version changes', () => {
    mem.data = JSON.stringify(makeTracker({ currentVersion: '1.0.0', crashCount: 5 }));
    const tracker = recordCrash(trackerPath, '2.0.0', {
      ...memDeps,
      readFileSync: () => mem.data,
    });
    expect(tracker.currentVersion).toBe('2.0.0');
    expect(tracker.crashCount).toBe(1);
  });
});

describe('evaluateRollback', () => {
  test('returns shouldRollback=true when crash threshold met within window', () => {
    const tracker = makeTracker({
      currentVersion: '1.0.0',
      crashCount: MAX_CRASHES,
      firstCrashTimestamp: Date.now() - 1000,
    });
    const decision = evaluateRollback(tracker, '1.0.0');
    expect(decision.shouldRollback).toBe(true);
    expect(decision.reason).toContain('crashed');
  });

  test('returns shouldRollback=false when crash threshold not met', () => {
    const tracker = makeTracker({ currentVersion: '1.0.0', crashCount: 1 });
    const decision = evaluateRollback(tracker, '1.0.0');
    expect(decision.shouldRollback).toBe(false);
    expect(decision.reason).toBe('crash-threshold-not-met');
  });

  test('returns shouldRollback=false when version changed', () => {
    const tracker = makeTracker({
      currentVersion: '1.0.0',
      crashCount: MAX_CRASHES,
    });
    const decision = evaluateRollback(tracker, '2.0.0');
    expect(decision.shouldRollback).toBe(false);
    expect(decision.reason).toBe('version-changed');
  });

  test('returns shouldRollback=false when crash window expired', () => {
    const tracker = makeTracker({
      currentVersion: '1.0.0',
      crashCount: MAX_CRASHES,
      firstCrashTimestamp: Date.now() - CRASH_WINDOW_MS - 1000,
    });
    const decision = evaluateRollback(tracker, '1.0.0');
    expect(decision.shouldRollback).toBe(false);
    expect(decision.reason).toBe('crash-window-expired');
  });

  test('returns shouldRollback=false when crash count is 0', () => {
    const tracker = makeTracker({ currentVersion: '1.0.0', crashCount: 0 });
    const decision = evaluateRollback(tracker, '1.0.0');
    expect(decision.shouldRollback).toBe(false);
  });
});

describe('isBadCrash', () => {
  test('returns true for non-zero exit code', () => {
    expect(isBadCrash(1)).toBe(true);
    expect(isBadCrash(137)).toBe(true);
    expect(isBadCrash(-1)).toBe(true);
  });

  test('returns false for exit code 0', () => {
    expect(isBadCrash(0)).toBe(false);
  });
});
