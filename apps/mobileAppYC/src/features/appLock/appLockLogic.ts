/**
 * Pure rules for app lock: when to lock on resume, what an unlock failure
 * means, which wording the prompt uses, and whether the phone can support
 * the lock at all.
 *
 * Nothing here talks to a native module, so every rule is testable as a
 * plain table. None of these functions can unlock the app: only a keychain
 * read that returns the exact marker does that (see appLockKeychain.ts).
 */
import {BIOMETRY_TYPE} from 'react-native-keychain';

/** "Immediately", 1, 5 and 15 minutes. */
export const APP_LOCK_TIMEOUT_OPTIONS_MS: readonly number[] = Object.freeze([
  0, 60_000, 300_000, 900_000,
]);

export const DEFAULT_APP_LOCK_TIMEOUT_MS = 60_000;

export const isAppLockTimeoutOption = (value: unknown): value is number =>
  typeof value === 'number' && APP_LOCK_TIMEOUT_OPTIONS_MS.includes(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export interface ResumeClocks {
  /** Wall-clock milliseconds since the app went to the background. */
  wallElapsed: number | null;
  /**
   * Milliseconds on a clock that keeps counting while the phone sleeps and
   * that Settings cannot change. Null when the native module is missing.
   */
  monoElapsed: number | null;
  timeoutMs: number;
}

/**
 * Whether the app must show the lock when it comes back to the foreground.
 *
 * Fails closed: a gap that cannot be measured, or one that went backwards
 * (the wall clock was set back), counts as the time being up. Either clock
 * reaching the timeout is enough, so moving the phone clock back cannot skip
 * the lock.
 */
export const shouldLockOnResume = ({
  wallElapsed,
  monoElapsed,
  timeoutMs,
}: ResumeClocks): boolean => {
  if (!isFiniteNumber(timeoutMs) || timeoutMs < 0) {
    return true;
  }
  if (!isFiniteNumber(wallElapsed) || !isFiniteNumber(monoElapsed)) {
    return true;
  }
  if (wallElapsed < 0 || monoElapsed < 0) {
    return true;
  }
  return wallElapsed >= timeoutMs || monoElapsed >= timeoutMs;
};

export type UnlockFailure = 'cancelled' | 'lockout' | 'invalidated' | 'failed';

/** errSecUserCanceled, as react-native-keychain reports it on iOS. */
const IOS_USER_CANCELED = '-128';

/**
 * Android BiometricPrompt error codes. react-native-keychain rejects with
 * E_CRYPTO_FAILED and the message "code: N, msg: ...".
 * 5 ERROR_CANCELED, 10 ERROR_USER_CANCELED, 13 ERROR_NEGATIVE_BUTTON.
 * 7 ERROR_LOCKOUT, 9 ERROR_LOCKOUT_PERMANENT.
 */
const ANDROID_CANCEL_CODES = new Set([5, 10, 13]);
const ANDROID_LOCKOUT_CODES = new Set([7, 9]);
const ANDROID_PROMPT_CODE = /\bcode: ?(\d+)/;

const INVALIDATED_KEY = /KeyPermanentlyInvalidated|permanently invalidated/i;

const readText = (value: unknown, key: 'code' | 'message'): string => {
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' || typeof field === 'number'
    ? String(field)
    : '';
};

/**
 * Chooses which message the lock screen shows after a failed unlock.
 *
 * It only picks wording. The caller has already decided the app stays
 * locked, and no value returned here changes that.
 */
export const classifyUnlockError = (error: unknown): UnlockFailure => {
  const message =
    typeof error === 'string' ? error : readText(error, 'message');

  if (readText(error, 'code') === IOS_USER_CANCELED) {
    return 'cancelled';
  }

  // A prompt error is about the prompt, never about the key, so it is
  // settled here before the invalidated check can see its message.
  const promptCode = ANDROID_PROMPT_CODE.exec(message);
  if (promptCode) {
    const code = Number(promptCode[1]);
    if (ANDROID_CANCEL_CODES.has(code)) {
      return 'cancelled';
    }
    if (ANDROID_LOCKOUT_CODES.has(code)) {
      return 'lockout';
    }
    return 'failed';
  }

  if (INVALIDATED_KEY.test(message)) {
    return 'invalidated';
  }
  return 'failed';
};

export type UnlockMethod =
  'faceId' | 'touchId' | 'opticId' | 'fingerprint' | 'screenLock' | 'passcode';

/**
 * The wording for the phone's own check.
 *
 * Android face and iris sensors, and phones without Class 3 biometrics, get
 * the generic "screen lock" wording, because the prompt may offer the PIN,
 * pattern or password instead. Returns null when the phone has no check the
 * lock could use.
 */
export const methodFromBiometry = (
  type: BIOMETRY_TYPE | null,
  platform: string,
  hasPasscode: boolean,
): UnlockMethod | null => {
  switch (type) {
    case BIOMETRY_TYPE.FACE_ID:
      return 'faceId';
    case BIOMETRY_TYPE.TOUCH_ID:
      return 'touchId';
    case BIOMETRY_TYPE.OPTIC_ID:
      return 'opticId';
    case BIOMETRY_TYPE.FINGERPRINT:
      return 'fingerprint';
    default:
      break;
  }
  if (platform === 'android') {
    return type !== null || hasPasscode ? 'screenLock' : null;
  }
  return hasPasscode ? 'passcode' : null;
};

export type AppLockUnavailableReason =
  'noPasscode' | 'androidVersion' | 'noStrongBiometrics';

export type AppLockAvailability =
  {available: true} | {available: false; reason: AppLockUnavailableReason};

export interface DeviceSupport {
  platform: string;
  /** Platform.Version on Android. Ignored on iOS. */
  apiLevel: number;
  /**
   * A device passcode or screen lock is set. On Android below API 30
   * react-native-keychain always reports false here.
   */
  hasPasscode: boolean;
  /** Class 3 biometrics are enrolled (getSupportedBiometryType is not null). */
  hasStrongBiometrics: boolean;
}

const unavailable = (
  reason: AppLockUnavailableReason,
): AppLockAvailability => ({
  available: false,
  reason,
});

/**
 * Whether turning the lock on can succeed on this phone.
 *
 * Android 9 and 10 (API 28-29) cannot pair the device credential with a
 * keystore key, and below Android 11 (API 30) only Class 3 biometrics can
 * open the key, so enabling would always fail there.
 */
export const availability = ({
  platform,
  apiLevel,
  hasPasscode,
  hasStrongBiometrics,
}: DeviceSupport): AppLockAvailability => {
  if (platform === 'android') {
    if (apiLevel === 28 || apiLevel === 29) {
      return unavailable('androidVersion');
    }
    if (apiLevel < 30) {
      return hasStrongBiometrics
        ? {available: true}
        : unavailable('noStrongBiometrics');
    }
  }
  return hasPasscode ? {available: true} : unavailable('noPasscode');
};
