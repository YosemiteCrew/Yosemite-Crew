'use strict';

export const ROLLBACK_FILENAME = 'rollback-tracker.json';
export const MAX_CRASHES = 3;
export const CRASH_WINDOW_MS = 5 * 60 * 1000;

export interface RollbackTracker {
  currentVersion: string;
  crashCount: number;
  lastCrashTimestamp: number;
  firstCrashTimestamp: number;
  updatedAt: number;
}

export interface RollbackDecision {
  shouldRollback: boolean;
  reason: string;
  tracker: RollbackTracker;
}

interface TrackerDeps {
  readFileSync?: (path: string, encoding: string) => string;
  writeFileSync?: (path: string, data: string, encoding: string) => void;
  mkdirSync?: (path: string, options: { recursive: boolean }) => void;
  pathDirname?: (path: string) => string;
}

const defaultTracker = (): RollbackTracker => ({
  currentVersion: '',
  crashCount: 0,
  lastCrashTimestamp: 0,
  firstCrashTimestamp: 0,
  updatedAt: Date.now(),
});

export const readTracker = (filePath: string, deps: TrackerDeps = {}): RollbackTracker => {
  const readFileSync = deps.readFileSync;
  if (!readFileSync) return defaultTracker();
  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as Partial<RollbackTracker>;
    return {
      currentVersion: typeof data.currentVersion === 'string' ? data.currentVersion : '',
      crashCount: typeof data.crashCount === 'number' ? data.crashCount : 0,
      lastCrashTimestamp: typeof data.lastCrashTimestamp === 'number' ? data.lastCrashTimestamp : 0,
      firstCrashTimestamp:
        typeof data.firstCrashTimestamp === 'number' ? data.firstCrashTimestamp : 0,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    };
  } catch {
    return defaultTracker();
  }
};

export const resetTracker = (
  filePath: string,
  version: string,
  deps: TrackerDeps = {}
): RollbackTracker => {
  const fresh: RollbackTracker = {
    currentVersion: version,
    crashCount: 0,
    lastCrashTimestamp: 0,
    firstCrashTimestamp: 0,
    updatedAt: Date.now(),
  };
  writeTracker(filePath, fresh, deps);
  return fresh;
};

export const writeTracker = (
  filePath: string,
  tracker: RollbackTracker,
  deps: TrackerDeps = {}
): void => {
  const writeFileSync = deps.writeFileSync;
  const mkdirSync = deps.mkdirSync;
  const pathDirname =
    deps.pathDirname ||
    ((p: string) => {
      const lastSlash = p.lastIndexOf('/');
      return lastSlash >= 0 ? p.slice(0, lastSlash) : '.';
    });
  if (!writeFileSync) return;
  try {
    if (mkdirSync) mkdirSync(pathDirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(tracker, null, 2), 'utf8');
  } catch {
    // rollback tracking must never break the app
  }
};

export const recordCrash = (
  filePath: string,
  currentVersion: string,
  deps: TrackerDeps = {}
): RollbackTracker => {
  const tracker = readTracker(filePath, deps);
  const now = Date.now();

  if (tracker.currentVersion !== currentVersion) {
    const fresh: RollbackTracker = {
      currentVersion,
      crashCount: 1,
      lastCrashTimestamp: now,
      firstCrashTimestamp: now,
      updatedAt: now,
    };
    writeTracker(filePath, fresh, deps);
    return fresh;
  }

  const windowStart = now - CRASH_WINDOW_MS;
  if (tracker.lastCrashTimestamp < windowStart) {
    const reset: RollbackTracker = {
      currentVersion,
      crashCount: 1,
      lastCrashTimestamp: now,
      firstCrashTimestamp: now,
      updatedAt: now,
    };
    writeTracker(filePath, reset, deps);
    return reset;
  }

  const updated: RollbackTracker = {
    ...tracker,
    crashCount: tracker.crashCount + 1,
    lastCrashTimestamp: now,
    updatedAt: now,
  };
  writeTracker(filePath, updated, deps);
  return updated;
};

export const evaluateRollback = (
  tracker: RollbackTracker,
  currentVersion: string
): RollbackDecision => {
  if (tracker.currentVersion !== currentVersion) {
    return {
      shouldRollback: false,
      reason: 'version-changed',
      tracker,
    };
  }

  if (tracker.crashCount >= MAX_CRASHES) {
    const withinWindow = Date.now() - tracker.firstCrashTimestamp < CRASH_WINDOW_MS;
    if (withinWindow) {
      return {
        shouldRollback: true,
        reason: `crashed ${tracker.crashCount} times within ${CRASH_WINDOW_MS / 1000}s after update`,
        tracker,
      };
    }
    return {
      shouldRollback: false,
      reason: 'crash-window-expired',
      tracker,
    };
  }

  return {
    shouldRollback: false,
    reason: 'crash-threshold-not-met',
    tracker,
  };
};

export const isBadCrash = (exitCode: number): boolean => exitCode !== 0;
