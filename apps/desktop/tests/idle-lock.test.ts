import {
  IDLE_LOCK_ENV,
  idleLockMinutesFromEnv,
  reduceIdleLock,
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
