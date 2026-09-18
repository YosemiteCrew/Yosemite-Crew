/**
 * Safe access to the AppLock native module.
 *
 * The module draws the privacy cover in the iOS app switcher, blanks the
 * Android recents thumbnail, and supplies a clock that keeps counting while
 * the phone sleeps. It is absent in Jest and in a JS reload before the
 * native side registers, so every call here resolves to a fallback instead
 * of throwing.
 */
import {NativeModules} from 'react-native';

export interface AppLockNativeModule {
  /** Milliseconds on a clock that counts through sleep and ignores Settings. */
  monotonicNow(): Promise<number>;
  /** Saved natively so the cover and recents setting work before JS runs. */
  setPrivacy(enabled: boolean, timeoutMs: number): Promise<boolean>;
  /** Tells iOS the JS cover or lock screen has drawn, so its cover can go. */
  coverRendered(): Promise<boolean>;
  /** Closes share sheets, payment sheets, alerts and pickers above the app. */
  dismissSystemSheets(): Promise<boolean>;
}

const getModule = (): AppLockNativeModule => {
  const candidate = (NativeModules as Record<string, unknown>).AppLock;
  if (!candidate) {
    throw new Error('The AppLock native module is not registered.');
  }
  return candidate as AppLockNativeModule;
};

/** One fallback path for a missing module and for a failed call alike. */
const settle = async <T>(
  call: (native: AppLockNativeModule) => Promise<T>,
  fallback: T,
): Promise<T> => {
  try {
    return await call(getModule());
  } catch {
    return fallback;
  }
};

/**
 * The sleep-proof clock, or null when it cannot be read. The lock rules
 * treat null as "time is up", so a missing clock never skips the lock.
 */
export const monotonicNow = (): Promise<number | null> =>
  settle(async native => {
    const value = await native.monotonicNow();
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }, null);

/**
 * Turns the native privacy cover on or off. A timeout that is not a
 * non-negative number is sent as 0 ("immediately"), the strictest setting.
 */
export const setPrivacy = (
  enabled: boolean,
  timeoutMs: number,
): Promise<boolean> => {
  const safeTimeout =
    Number.isFinite(timeoutMs) && timeoutMs >= 0 ? Math.floor(timeoutMs) : 0;
  return settle(native => native.setPrivacy(enabled, safeTimeout), false);
};

/**
 * Call after every return from the background, once the JS cover or lock
 * screen has drawn. Until then iOS keeps its own cover up. When the app was
 * only inactive (the Face ID sheet, Control Center, a system alert), iOS
 * takes its cover down by itself as the app becomes active again, so a call
 * then is harmless but not needed.
 */
export const coverRendered = (): Promise<boolean> =>
  settle(native => native.coverRendered(), false);

export const dismissSystemSheets = (): Promise<boolean> =>
  settle(native => native.dismissSystemSheets(), false);
