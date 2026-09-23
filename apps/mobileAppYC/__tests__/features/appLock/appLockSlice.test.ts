import {
  appCovered,
  appLockDisabled,
  appLockEnabled,
  appLockReducer,
  appLockStatusReducer,
  appLockTimeoutChanged,
  appLocked,
  appUncovered,
  appUnlocked,
  authenticatingChanged,
  initialAppLockSettings,
  initialAppLockStatus,
} from '@/features/appLock/appLockSlice';

describe('appLock settings slice', () => {
  it('starts with the lock off, a one-minute timeout and no owner', () => {
    expect(appLockReducer(undefined, {type: '@@INIT'})).toEqual({
      enabled: false,
      timeoutMs: 60_000,
      ownerId: null,
    });
    expect(initialAppLockSettings).toEqual({
      enabled: false,
      timeoutMs: 60_000,
      ownerId: null,
    });
  });

  it('records the owner when the lock is turned on', () => {
    const state = appLockReducer(
      initialAppLockSettings,
      appLockEnabled({ownerId: 'parent-1'}),
    );

    expect(state).toEqual({
      enabled: true,
      timeoutMs: 60_000,
      ownerId: 'parent-1',
    });
  });

  it('clears the owner and keeps the timeout when the lock is turned off', () => {
    const on = {enabled: true, timeoutMs: 300_000, ownerId: 'parent-1'};

    expect(appLockReducer(on, appLockDisabled())).toEqual({
      enabled: false,
      timeoutMs: 300_000,
      ownerId: null,
    });
  });

  it.each([0, 60_000, 300_000, 900_000])(
    'accepts the offered timeout %p',
    ms => {
      expect(
        appLockReducer(initialAppLockSettings, appLockTimeoutChanged(ms))
          .timeoutMs,
      ).toBe(ms);
    },
  );

  it.each([120_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores the timeout %p, which is not offered',
    ms => {
      const state = {...initialAppLockSettings, timeoutMs: 300_000};

      expect(appLockReducer(state, appLockTimeoutChanged(ms)).timeoutMs).toBe(
        300_000,
      );
    },
  );
});

describe('appLockStatus slice', () => {
  it('starts locked and covered on every cold start', () => {
    expect(appLockStatusReducer(undefined, {type: '@@INIT'})).toEqual({
      locked: true,
      covered: true,
      authenticating: false,
    });
    expect(initialAppLockStatus).toEqual({
      locked: true,
      covered: true,
      authenticating: false,
    });
  });

  it('unlocking uncovers the app and ends authentication', () => {
    const state = appLockStatusReducer(
      {locked: true, covered: true, authenticating: true},
      appUnlocked(),
    );

    expect(state).toEqual({
      locked: false,
      covered: false,
      authenticating: false,
    });
  });

  it('locking covers the app', () => {
    const state = appLockStatusReducer(
      {locked: false, covered: false, authenticating: false},
      appLocked(),
    );

    expect(state).toEqual({locked: true, covered: true, authenticating: false});
  });

  it('covers without locking', () => {
    const state = appLockStatusReducer(
      {locked: false, covered: false, authenticating: false},
      appCovered(),
    );

    expect(state).toEqual({
      locked: false,
      covered: true,
      authenticating: false,
    });
  });

  it('uncovers an unlocked app', () => {
    const state = appLockStatusReducer(
      {locked: false, covered: true, authenticating: false},
      appUncovered(),
    );

    expect(state.covered).toBe(false);
  });

  it('keeps a locked app covered when asked to uncover', () => {
    const state = appLockStatusReducer(
      {locked: true, covered: true, authenticating: false},
      appUncovered(),
    );

    expect(state).toEqual({locked: true, covered: true, authenticating: false});
  });

  it('tracks whether the OS prompt is open', () => {
    const open = appLockStatusReducer(
      initialAppLockStatus,
      authenticatingChanged(true),
    );
    const closed = appLockStatusReducer(open, authenticatingChanged(false));

    expect(open.authenticating).toBe(true);
    expect(open.locked).toBe(true);
    expect(closed.authenticating).toBe(false);
  });
});
