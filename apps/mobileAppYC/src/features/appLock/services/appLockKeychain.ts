/**
 * The app lock marker in the keychain.
 *
 * Turning the lock on stores a fixed marker that only the phone's own check
 * (Face ID, Touch ID, fingerprint, or the device passcode) can read back.
 * Unlocking means reading it: the app unlocks only when the read returns
 * exactly that marker, and every other outcome keeps it locked.
 *
 * Every call passes the same options. On Android the prompt and the cipher
 * come from the options given to each read, so a read that dropped them
 * would behave differently from the write. This item is separate from the
 * `yosemite-crew-session` item, which must never gain access control.
 */
import i18next from 'i18next';
import * as Keychain from 'react-native-keychain';

import {classifyUnlockError, type UnlockFailure} from '../appLockLogic';

export const APP_LOCK_SERVICE = 'yosemite-crew-app-lock';
export const APP_LOCK_MARKER_USERNAME = 'app-lock';
/** Not a secret: the keychain access control is what protects the item. */
export const APP_LOCK_MARKER_VALUE = 'app-lock-marker-v1';

/**
 * How long an unlock waits for the OS prompt. A result that arrives later is
 * ignored, so a prompt left hanging can never unlock the app afterwards.
 */
export const UNLOCK_TIMEOUT_MS = 60_000;

export const APP_LOCK_KEYCHAIN_OPTIONS = Object.freeze({
  service: APP_LOCK_SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  storage: Keychain.STORAGE_TYPE.AES_GCM,
});

/**
 * The options for every keychain call. A fresh copy each time, because
 * react-native-keychain writes the prompt defaults into the object it gets;
 * the frozen original stays untouched. The prompt text is read at call time
 * so it follows the app language.
 */
const keychainOptions = (): Keychain.SetOptions => ({
  ...APP_LOCK_KEYCHAIN_OPTIONS,
  authenticationPrompt: {
    title: i18next.t('appLock.prompt.title'),
    cancel: i18next.t('appLock.prompt.cancel'),
  },
});

export type AppLockResult = {ok: true} | {ok: false; reason: UnlockFailure};

const failed = (reason: UnlockFailure): AppLockResult => ({ok: false, reason});

const TIMED_OUT = Symbol('timedOut');

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const isMarker = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const {username, password} = value as Record<string, unknown>;
  return (
    username === APP_LOCK_MARKER_USERNAME && password === APP_LOCK_MARKER_VALUE
  );
};

/**
 * Reads the marker behind the OS prompt. `{ok: true}` comes from one place
 * only: a read that returned the exact marker in time.
 */
export const unlock = async (): Promise<AppLockResult> => {
  try {
    const result = await withTimeout(
      Keychain.getGenericPassword(keychainOptions()),
      UNLOCK_TIMEOUT_MS,
    );
    if (result === TIMED_OUT) {
      return failed('failed');
    }
    if (result === false) {
      // No item: the passcode was removed, or the marker was never written.
      return failed('invalidated');
    }
    return isMarker(result) ? {ok: true} : failed('failed');
  } catch (error) {
    return failed(classifyUnlockError(error));
  }
};

const removeMarker = async (): Promise<boolean> => {
  try {
    return (await Keychain.resetGenericPassword(keychainOptions())) === true;
  } catch {
    return false;
  }
};

/**
 * Writes the marker, then reads it back once through the OS prompt. If
 * either step fails the item is removed, so a half-written marker can never
 * leave the lock on with no way to open it.
 */
export const enable = async (): Promise<AppLockResult> => {
  try {
    const stored = await Keychain.setGenericPassword(
      APP_LOCK_MARKER_USERNAME,
      APP_LOCK_MARKER_VALUE,
      keychainOptions(),
    );
    if (!stored) {
      await removeMarker();
      return failed('failed');
    }
  } catch (error) {
    await removeMarker();
    return failed(classifyUnlockError(error));
  }

  const confirmed = await unlock();
  if (!confirmed.ok) {
    await removeMarker();
  }
  return confirmed;
};

/** Removes the marker, but only after the OS prompt has been passed. */
export const disable = async (): Promise<AppLockResult> => {
  const unlocked = await unlock();
  if (!unlocked.ok) {
    return unlocked;
  }
  return (await removeMarker()) ? {ok: true} : failed('failed');
};

/**
 * Whether the marker exists. Never shows a prompt.
 *
 * Callers OR this with the saved flag, so it can only turn the lock on. A
 * failed check answers false and leaves the decision to the flag.
 */
export const isArmed = async (): Promise<boolean> => {
  try {
    return (await Keychain.hasGenericPassword(keychainOptions())) === true;
  } catch {
    return false;
  }
};
