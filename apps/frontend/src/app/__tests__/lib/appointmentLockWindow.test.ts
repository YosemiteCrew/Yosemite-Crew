import {
  DEFAULT_LOCK_WINDOW,
  MAX_LOCK_HOURS,
  MIN_LOCK_HOURS,
  clampLockHours,
  clearSavedLockWindow,
  getSavedLockWindow,
  resolveLockHours,
  setSavedLockWindow,
} from '@/app/lib/appointmentLockWindow';

const STORAGE_KEY = 'yc_appointment_lock_window';

beforeEach(() => {
  window.localStorage.clear();
});

describe('clampLockHours', () => {
  it('clamps below the minimum', () => {
    expect(clampLockHours(0)).toBe(MIN_LOCK_HOURS);
    expect(clampLockHours(-50)).toBe(MIN_LOCK_HOURS);
  });

  it('clamps above the maximum', () => {
    expect(clampLockHours(99999)).toBe(MAX_LOCK_HOURS);
  });

  it('rounds fractional hours', () => {
    expect(clampLockHours(12.6)).toBe(13);
  });

  it('falls back to the default for non-finite input', () => {
    // Non-finite values (NaN / ±Infinity) are not clampable, so we revert to the default.
    expect(clampLockHours(Number.NaN)).toBe(DEFAULT_LOCK_WINDOW.outpatientHours);
    expect(clampLockHours(Number.POSITIVE_INFINITY)).toBe(DEFAULT_LOCK_WINDOW.outpatientHours);
  });
});

describe('getSavedLockWindow', () => {
  it('returns defaults when nothing is saved', () => {
    expect(getSavedLockWindow()).toEqual(DEFAULT_LOCK_WINDOW);
  });

  it('returns the saved window', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ outpatientHours: 12, inpatientHours: 48 })
    );
    expect(getSavedLockWindow()).toEqual({ outpatientHours: 12, inpatientHours: 48 });
  });

  it('replaces invalid fields with defaults', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ outpatientHours: -3, inpatientHours: 99999 })
    );
    expect(getSavedLockWindow()).toEqual(DEFAULT_LOCK_WINDOW);
  });

  it('returns defaults for malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    expect(getSavedLockWindow()).toEqual(DEFAULT_LOCK_WINDOW);
  });
});

describe('setSavedLockWindow', () => {
  it('persists clamped values and dispatches a change event', () => {
    const handler = jest.fn();
    window.addEventListener('yc:appointment-lock-window-changed', handler);

    const ok = setSavedLockWindow({ outpatientHours: 0, inpatientHours: 99999 });

    expect(ok).toBe(true);
    expect(getSavedLockWindow()).toEqual({
      outpatientHours: MIN_LOCK_HOURS,
      inpatientHours: MAX_LOCK_HOURS,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('yc:appointment-lock-window-changed', handler);
  });
});

describe('clearSavedLockWindow', () => {
  it('removes the override so defaults apply again', () => {
    setSavedLockWindow({ outpatientHours: 6, inpatientHours: 6 });
    expect(getSavedLockWindow()).toEqual({ outpatientHours: 6, inpatientHours: 6 });
    clearSavedLockWindow();
    expect(getSavedLockWindow()).toEqual(DEFAULT_LOCK_WINDOW);
  });
});

describe('resolveLockHours', () => {
  it('picks the right field per mode', () => {
    const window = { outpatientHours: 10, inpatientHours: 72 };
    expect(resolveLockHours('OUTPATIENT', window)).toBe(10);
    expect(resolveLockHours('INPATIENT', window)).toBe(72);
  });

  it('defaults to the saved window when none is passed', () => {
    setSavedLockWindow({ outpatientHours: 8, inpatientHours: 8 });
    expect(resolveLockHours('OUTPATIENT')).toBe(8);
  });
});
