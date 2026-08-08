import {
  IDLE_LOCK_ENV,
  idleLockMinutesFromEnv,
  reduceIdleLock,
  resolveIdleLockMinutes,
  shouldLockAfterIdle,
} from '../src/lifecycle/idle-lock';

describe('idle lock helpers', () => {
  test('is disabled by default and rejects invalid values', () => {
    expect(idleLockMinutesFromEnv({})).toBeNull();
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: '0' })).toBeNull();
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: '-5' })).toBeNull();
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: 'abc' })).toBeNull();
  });

  test('reads positive minute values and caps extreme values', () => {
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: '5' })).toBe(5);
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: '2.2' })).toBe(3);
    expect(idleLockMinutesFromEnv({ [IDLE_LOCK_ENV]: '9999' })).toBe(1440);
  });

  describe('resolveIdleLockMinutes', () => {
    test('treats the managed value as a ceiling the user setting cannot weaken', () => {
      // A looser user preference must not override an MDM-mandated 5 minutes.
      expect(resolveIdleLockMinutes(60, 5)).toBe(5);
      // A stricter user preference is honoured.
      expect(resolveIdleLockMinutes(2, 5)).toBe(2);
      // Unset/disabled/invalid user values fall back to the managed policy
      // rather than disabling the lock.
      expect(resolveIdleLockMinutes(undefined, 5)).toBe(5);
      expect(resolveIdleLockMinutes(0, 5)).toBe(5);
      expect(resolveIdleLockMinutes(-10, 5)).toBe(5);
      expect(resolveIdleLockMinutes('60', 5)).toBe(5);
    });

    test('falls back to the user setting when no managed policy exists', () => {
      expect(resolveIdleLockMinutes(60, null)).toBe(60);
      expect(resolveIdleLockMinutes(0, null)).toBe(0);
      expect(resolveIdleLockMinutes(undefined, null)).toBe(0);
    });
  });

  test('locks only after the configured idle duration', () => {
    expect(shouldLockAfterIdle(1_000, 60_999, 1)).toBe(false);
    expect(shouldLockAfterIdle(1_000, 61_000, 1)).toBe(true);
    expect(shouldLockAfterIdle(1_000, 61_000, null)).toBe(false);
    expect(shouldLockAfterIdle(61_000, 1_000, 1)).toBe(false);
  });

  test('reducer locks on idle ticks and resets on activity', () => {
    const initial = { locked: false, lastActiveAtMs: 0 };
    const locked = reduceIdleLock(initial, { type: 'tick', nowMs: 300_000 }, 5);
    expect(locked).toEqual({ locked: true, lastActiveAtMs: 0 });

    expect(reduceIdleLock(locked, { type: 'activity', nowMs: 301_000 }, 5)).toEqual({
      locked: false,
      lastActiveAtMs: 301_000,
    });
  });

  test('unlock records the current activity time', () => {
    expect(
      reduceIdleLock({ locked: true, lastActiveAtMs: 0 }, { type: 'unlock', nowMs: 10 }, 1)
    ).toEqual({
      locked: false,
      lastActiveAtMs: 10,
    });
  });
});
