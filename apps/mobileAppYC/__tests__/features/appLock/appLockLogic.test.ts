import {BIOMETRY_TYPE} from 'react-native-keychain';

import {
  APP_LOCK_TIMEOUT_OPTIONS_MS,
  DEFAULT_APP_LOCK_TIMEOUT_MS,
  availability,
  classifyUnlockError,
  isAppLockTimeoutOption,
  methodFromBiometry,
  shouldLockOnResume,
  type DeviceSupport,
  type ResumeClocks,
} from '@/features/appLock/appLockLogic';

const MINUTE = 60_000;

describe('shouldLockOnResume', () => {
  const rows: Array<[string, ResumeClocks, boolean]> = [
    [
      'both clocks inside the timeout',
      {wallElapsed: 10_000, monoElapsed: 10_000, timeoutMs: MINUTE},
      false,
    ],
    [
      'both clocks exactly at the timeout',
      {wallElapsed: MINUTE, monoElapsed: MINUTE, timeoutMs: MINUTE},
      true,
    ],
    [
      'wall clock exactly at the timeout, monotonic inside',
      {wallElapsed: MINUTE, monoElapsed: 1_000, timeoutMs: MINUTE},
      true,
    ],
    [
      'monotonic exactly at the timeout, wall inside',
      {wallElapsed: 1_000, monoElapsed: MINUTE, timeoutMs: MINUTE},
      true,
    ],
    [
      'both clocks past the timeout',
      {wallElapsed: 2 * MINUTE, monoElapsed: 2 * MINUTE, timeoutMs: MINUTE},
      true,
    ],
    [
      'small wall gap, large monotonic gap (clock set back while away)',
      {wallElapsed: 5_000, monoElapsed: 2 * 60 * MINUTE, timeoutMs: MINUTE},
      true,
    ],
    [
      'zero wall gap, monotonic one ms past the timeout',
      {wallElapsed: 0, monoElapsed: MINUTE + 1, timeoutMs: MINUTE},
      true,
    ],
    [
      'large wall gap, small monotonic gap',
      {wallElapsed: 2 * 60 * MINUTE, monoElapsed: 5_000, timeoutMs: MINUTE},
      true,
    ],
    [
      'wall clock went backwards',
      {wallElapsed: -5_000, monoElapsed: 1_000, timeoutMs: MINUTE},
      true,
    ],
    [
      'monotonic clock went backwards',
      {wallElapsed: 1_000, monoElapsed: -1, timeoutMs: MINUTE},
      true,
    ],
    [
      'immediately, returning at once',
      {wallElapsed: 0, monoElapsed: 0, timeoutMs: 0},
      true,
    ],
    [
      'fifteen minutes, back after fourteen',
      {
        wallElapsed: 14 * MINUTE,
        monoElapsed: 14 * MINUTE,
        timeoutMs: 15 * MINUTE,
      },
      false,
    ],
    [
      'monotonic clock unavailable',
      {wallElapsed: 1_000, monoElapsed: null, timeoutMs: MINUTE},
      true,
    ],
    [
      'wall time unavailable',
      {wallElapsed: null, monoElapsed: 1_000, timeoutMs: MINUTE},
      true,
    ],
    [
      'NaN elapsed time',
      {wallElapsed: Number.NaN, monoElapsed: 1_000, timeoutMs: MINUTE},
      true,
    ],
    [
      'saved timeout is corrupt',
      {
        wallElapsed: 1_000,
        monoElapsed: 1_000,
        timeoutMs: undefined as unknown as number,
      },
      true,
    ],
    [
      'saved timeout is negative',
      {wallElapsed: 1_000, monoElapsed: 1_000, timeoutMs: -1},
      true,
    ],
  ];

  it.each(rows)('%s -> locks: %s', (_label, clocks, expected) => {
    expect(shouldLockOnResume(clocks)).toBe(expected);
  });
});

describe('classifyUnlockError', () => {
  const rows: Array<[string, unknown, string]> = [
    [
      'iOS user cancel',
      {code: '-128', message: 'User canceled the operation.'},
      'cancelled',
    ],
    [
      'Android ERROR_CANCELED',
      {code: 'E_CRYPTO_FAILED', message: 'code: 5, msg: Cancelled'},
      'cancelled',
    ],
    [
      'Android ERROR_USER_CANCELED',
      {code: 'E_CRYPTO_FAILED', message: 'code: 10, msg: Cancelled by user'},
      'cancelled',
    ],
    [
      'Android ERROR_NEGATIVE_BUTTON',
      {code: 'E_CRYPTO_FAILED', message: 'code: 13, msg: Cancel'},
      'cancelled',
    ],
    [
      'Android ERROR_LOCKOUT',
      {code: 'E_CRYPTO_FAILED', message: 'code: 7, msg: Too many attempts'},
      'lockout',
    ],
    [
      'Android ERROR_LOCKOUT_PERMANENT',
      {code: 'E_CRYPTO_FAILED', message: 'code: 9, msg: Too many attempts'},
      'lockout',
    ],
    [
      'Android prompt error that is neither cancel nor lockout',
      {code: 'E_CRYPTO_FAILED', message: 'code: 1, msg: Hardware unavailable'},
      'failed',
    ],
    [
      'Android cancel whose text also mentions an invalidated key',
      {
        code: 'E_CRYPTO_FAILED',
        message: 'code: 10, msg: KeyPermanentlyInvalidatedException',
      },
      'cancelled',
    ],
    [
      'Android lockout whose text also mentions an invalidated key',
      {
        code: 'E_CRYPTO_FAILED',
        message: 'code: 7, msg: Key permanently invalidated',
      },
      'lockout',
    ],
    [
      'Android KeyPermanentlyInvalidatedException',
      {
        code: 'E_CRYPTO_FAILED',
        message:
          'android.security.keystore.KeyPermanentlyInvalidatedException: Key permanently invalidated',
      },
      'invalidated',
    ],
    [
      'invalidated key reported as an unknown error',
      {code: 'E_UNKNOWN_ERROR', message: 'Key permanently invalidated'},
      'invalidated',
    ],
    [
      'iOS authentication failed',
      {
        code: '-25293',
        message: 'The user name or passphrase you entered is not correct.',
      },
      'failed',
    ],
    ['a plain Error', new Error('boom'), 'failed'],
    ['a thrown string', 'code: 10, msg: cancelled', 'cancelled'],
    ['a thrown number', 42, 'failed'],
    ['undefined', undefined, 'failed'],
    ['null', null, 'failed'],
    ['an object with non-string fields', {code: {}, message: []}, 'failed'],
    ['a numeric iOS code', {code: -128}, 'cancelled'],
  ];

  it.each(rows)('%s -> %s', (_label, error, expected) => {
    expect(classifyUnlockError(error)).toBe(expected);
  });
});

describe('methodFromBiometry', () => {
  const rows: Array<[BIOMETRY_TYPE | null, string, boolean, string | null]> = [
    [BIOMETRY_TYPE.FACE_ID, 'ios', true, 'faceId'],
    [BIOMETRY_TYPE.TOUCH_ID, 'ios', true, 'touchId'],
    [BIOMETRY_TYPE.OPTIC_ID, 'ios', true, 'opticId'],
    [null, 'ios', true, 'passcode'],
    [null, 'ios', false, null],
    [BIOMETRY_TYPE.FINGERPRINT, 'android', false, 'fingerprint'],
    [BIOMETRY_TYPE.FINGERPRINT, 'android', true, 'fingerprint'],
    [BIOMETRY_TYPE.FACE, 'android', true, 'screenLock'],
    [BIOMETRY_TYPE.IRIS, 'android', false, 'screenLock'],
    [null, 'android', true, 'screenLock'],
    [null, 'android', false, null],
  ];

  it.each(rows)(
    '%s on %s (passcode %s) -> %s',
    (type, platform, hasPasscode, expected) => {
      expect(methodFromBiometry(type, platform, hasPasscode)).toBe(expected);
    },
  );
});

describe('availability', () => {
  const device = (overrides: Partial<DeviceSupport>): DeviceSupport => ({
    platform: 'android',
    apiLevel: 34,
    hasPasscode: true,
    hasStrongBiometrics: true,
    ...overrides,
  });

  const rows: Array<[string, Partial<DeviceSupport>, unknown]> = [
    [
      'iPhone with a passcode',
      {platform: 'ios', apiLevel: 0},
      {available: true},
    ],
    [
      'iPhone without a passcode',
      {
        platform: 'ios',
        apiLevel: 0,
        hasPasscode: false,
        hasStrongBiometrics: false,
      },
      {available: false, reason: 'noPasscode'},
    ],
    ['Android 14 with a screen lock', {}, {available: true}],
    [
      'Android 11 with a screen lock and no strong biometrics',
      {apiLevel: 30, hasStrongBiometrics: false},
      {available: true},
    ],
    [
      'Android 14 without a screen lock',
      {hasPasscode: false, hasStrongBiometrics: false},
      {available: false, reason: 'noPasscode'},
    ],
    [
      'Android 10',
      {apiLevel: 29},
      {available: false, reason: 'androidVersion'},
    ],
    ['Android 9', {apiLevel: 28}, {available: false, reason: 'androidVersion'}],
    [
      'Android 8.1 with Class 3 biometrics',
      {apiLevel: 27, hasPasscode: false},
      {available: true},
    ],
    [
      'Android 8.0 without Class 3 biometrics',
      {apiLevel: 26, hasPasscode: false, hasStrongBiometrics: false},
      {available: false, reason: 'noStrongBiometrics'},
    ],
    [
      'Android 7 without Class 3 biometrics but with a PIN',
      {apiLevel: 24, hasPasscode: true, hasStrongBiometrics: false},
      {available: false, reason: 'noStrongBiometrics'},
    ],
  ];

  it.each(rows)('%s', (_label, overrides, expected) => {
    expect(availability(device(overrides))).toEqual(expected);
  });
});

describe('timeout options', () => {
  it('offers immediately, 1, 5 and 15 minutes with 1 minute as the default', () => {
    expect(APP_LOCK_TIMEOUT_OPTIONS_MS).toEqual([
      0,
      MINUTE,
      5 * MINUTE,
      15 * MINUTE,
    ]);
    expect(DEFAULT_APP_LOCK_TIMEOUT_MS).toBe(MINUTE);
    expect(Object.isFrozen(APP_LOCK_TIMEOUT_OPTIONS_MS)).toBe(true);
  });

  it.each([
    [0, true],
    [MINUTE, true],
    [15 * MINUTE, true],
    [2 * MINUTE, false],
    [-1, false],
    ['60000', false],
    [Number.NaN, false],
  ])('%p is an offered option: %p', (value, expected) => {
    expect(isAppLockTimeoutOption(value)).toBe(expected);
  });
});
