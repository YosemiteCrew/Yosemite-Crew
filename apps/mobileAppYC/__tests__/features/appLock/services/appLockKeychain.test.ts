import * as Keychain from 'react-native-keychain';

import {
  APP_LOCK_KEYCHAIN_OPTIONS,
  APP_LOCK_MARKER_USERNAME,
  APP_LOCK_MARKER_VALUE,
  UNLOCK_TIMEOUT_MS,
  disable,
  enable,
  isArmed,
  unlock,
} from '@/features/appLock/services/appLockKeychain';

const keychain = Keychain as jest.Mocked<typeof Keychain>;

// The shipped English prompt comes from the real catalogue, which jest.setup
// loads into i18next.
const EXPECTED_OPTIONS = {
  service: 'yosemite-crew-app-lock',
  accessControl: 'BiometryAnyOrDevicePasscode',
  accessible: 'AccessibleWhenPasscodeSetThisDeviceOnly',
  storage: 'KeystoreAESGCM',
  authenticationPrompt: {title: 'Unlock Yosemite Crew', cancel: 'Cancel'},
};

const marker = (overrides: Record<string, unknown> = {}) => ({
  service: 'yosemite-crew-app-lock',
  storage: 'KeystoreAESGCM',
  username: APP_LOCK_MARKER_USERNAME,
  password: APP_LOCK_MARKER_VALUE,
  ...overrides,
});

const everyOptionsArgument = () => [
  ...keychain.setGenericPassword.mock.calls.map(call => call[2]),
  ...keychain.getGenericPassword.mock.calls.map(call => call[0]),
  ...keychain.resetGenericPassword.mock.calls.map(call => call[0]),
  ...keychain.hasGenericPassword.mock.calls.map(call => call[0]),
];

beforeEach(() => {
  jest.clearAllMocks();
  keychain.setGenericPassword.mockResolvedValue({
    service: 'yosemite-crew-app-lock',
    storage: Keychain.STORAGE_TYPE.AES_GCM,
  });
  keychain.getGenericPassword.mockResolvedValue(marker() as never);
  keychain.resetGenericPassword.mockResolvedValue(true);
  keychain.hasGenericPassword.mockResolvedValue(true);
});

describe('shared keychain options', () => {
  it('uses one frozen set of security options', () => {
    expect(Object.isFrozen(APP_LOCK_KEYCHAIN_OPTIONS)).toBe(true);
    expect(APP_LOCK_KEYCHAIN_OPTIONS).toEqual({
      service: 'yosemite-crew-app-lock',
      accessControl: 'BiometryAnyOrDevicePasscode',
      accessible: 'AccessibleWhenPasscodeSetThisDeviceOnly',
      storage: 'KeystoreAESGCM',
    });
  });

  it('never touches the session item', () => {
    expect(APP_LOCK_KEYCHAIN_OPTIONS.service).not.toBe('yosemite-crew-session');
  });

  it('sends the same options to the write and to every read, reset and check', async () => {
    await enable();
    await unlock();
    await disable();
    keychain.getGenericPassword.mockResolvedValueOnce(
      marker({username: 'x'}) as never,
    );
    await enable();
    await isArmed();

    const seen = everyOptionsArgument();

    expect(keychain.setGenericPassword).toHaveBeenCalledTimes(2);
    expect(keychain.getGenericPassword).toHaveBeenCalledTimes(4);
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(2);
    expect(keychain.hasGenericPassword).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(9);
    for (const options of seen) {
      expect(options).toStrictEqual(EXPECTED_OPTIONS);
    }
  });

  it('survives the library writing prompt defaults into the options it gets', async () => {
    const writeDefaults = (options: any) => {
      // normalizeAuthPrompt in react-native-keychain assigns to its argument.
      options.authenticationPrompt = {
        title: 'Authenticate to retrieve secret',
        ...options.authenticationPrompt,
      };
    };
    keychain.setGenericPassword.mockImplementation(async (_u, _p, options) => {
      writeDefaults(options);
      return {
        service: 'yosemite-crew-app-lock',
        storage: Keychain.STORAGE_TYPE.AES_GCM,
      };
    });
    keychain.getGenericPassword.mockImplementation(async options => {
      writeDefaults(options);
      return marker() as never;
    });

    await expect(enable()).resolves.toEqual({ok: true});
    expect(APP_LOCK_KEYCHAIN_OPTIONS).not.toHaveProperty(
      'authenticationPrompt',
    );
  });
});

describe('unlock', () => {
  it('unlocks only when the read returns the exact marker', async () => {
    await expect(unlock()).resolves.toEqual({ok: true});
    expect(keychain.getGenericPassword).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the read resolves false (no item)', false, 'invalidated'],
    ['the read resolves null', null, 'failed'],
    ['the read resolves undefined', undefined, 'failed'],
    ['the read resolves true', true, 'failed'],
    ['the read resolves a string', 'app-lock', 'failed'],
    ['the username is wrong', marker({username: 'someone-else'}), 'failed'],
    ['the username is missing', marker({username: undefined}), 'failed'],
    ['the stored value is wrong', marker({password: 'other'}), 'failed'],
  ])('stays locked when %s', async (_label, value, reason) => {
    keychain.getGenericPassword.mockResolvedValueOnce(value as never);

    await expect(unlock()).resolves.toEqual({ok: false, reason});
  });

  it('stays locked when the read rejects with an Error', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce(new Error('boom'));

    await expect(unlock()).resolves.toEqual({ok: false, reason: 'failed'});
  });

  it('stays locked when the read rejects with a value that is not an Error', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce('not an error');

    await expect(unlock()).resolves.toEqual({ok: false, reason: 'failed'});
  });

  it('stays locked when the read throws before returning a promise', async () => {
    keychain.getGenericPassword.mockImplementationOnce(() => {
      throw new TypeError('RNKeychainManager is undefined');
    });

    await expect(unlock()).resolves.toEqual({ok: false, reason: 'failed'});
  });

  it('reports a cancelled prompt as cancelled, still locked', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce({
      code: 'E_CRYPTO_FAILED',
      message: 'code: 10, msg: Cancelled by user',
    });

    await expect(unlock()).resolves.toEqual({ok: false, reason: 'cancelled'});
  });

  it('reports an invalidated key as invalidated, still locked', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce(
      new Error(
        'KeyPermanentlyInvalidatedException: Key permanently invalidated',
      ),
    );

    await expect(unlock()).resolves.toEqual({ok: false, reason: 'invalidated'});
  });

  describe('when the result never arrives', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('stays locked once the wait runs out', async () => {
      keychain.getGenericPassword.mockReturnValueOnce(new Promise(() => {}));
      let settled: unknown = 'pending';
      const pending = unlock().then(result => {
        settled = result;
        return result;
      });

      await jest.advanceTimersByTimeAsync(UNLOCK_TIMEOUT_MS - 1);
      expect(settled).toBe('pending');

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ok: false, reason: 'failed'});
    });

    it('ignores a marker that arrives after the wait ran out', async () => {
      let resolveLate: (value: unknown) => void = () => {};
      keychain.getGenericPassword.mockReturnValueOnce(
        new Promise(resolve => {
          resolveLate = resolve;
        }) as never,
      );
      const pending = unlock();

      await jest.advanceTimersByTimeAsync(UNLOCK_TIMEOUT_MS);
      resolveLate(marker());

      await expect(pending).resolves.toEqual({ok: false, reason: 'failed'});
    });

    it('does not leave a timer running after a prompt settles', async () => {
      await expect(unlock()).resolves.toEqual({ok: true});
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

describe('enable', () => {
  it('writes the marker and confirms it with one read', async () => {
    await expect(enable()).resolves.toEqual({ok: true});

    expect(keychain.setGenericPassword).toHaveBeenCalledWith(
      'app-lock',
      APP_LOCK_MARKER_VALUE,
      EXPECTED_OPTIONS,
    );
    expect(keychain.getGenericPassword).toHaveBeenCalledTimes(1);
    expect(keychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(
      keychain.setGenericPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(keychain.getGenericPassword.mock.invocationCallOrder[0]);
  });

  it('removes the marker when the confirming read is cancelled', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce({
      code: '-128',
      message: 'User canceled the operation.',
    });

    await expect(enable()).resolves.toEqual({ok: false, reason: 'cancelled'});
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('removes the marker when the confirming read returns something else', async () => {
    keychain.getGenericPassword.mockResolvedValueOnce(
      marker({username: 'x'}) as never,
    );

    await expect(enable()).resolves.toEqual({ok: false, reason: 'failed'});
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('does not read when the write reports failure, and cleans up', async () => {
    keychain.setGenericPassword.mockResolvedValueOnce(false);

    await expect(enable()).resolves.toEqual({ok: false, reason: 'failed'});
    expect(keychain.getGenericPassword).not.toHaveBeenCalled();
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('does not read when the write throws, and cleans up', async () => {
    keychain.setGenericPassword.mockRejectedValueOnce(new Error('no passcode'));

    await expect(enable()).resolves.toEqual({ok: false, reason: 'failed'});
    expect(keychain.getGenericPassword).not.toHaveBeenCalled();
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('still reports failure when the clean-up itself fails', async () => {
    keychain.getGenericPassword.mockRejectedValueOnce(new Error('boom'));
    keychain.resetGenericPassword.mockRejectedValueOnce(
      new Error('reset failed'),
    );

    await expect(enable()).resolves.toEqual({ok: false, reason: 'failed'});
  });
});

describe('disable', () => {
  it('removes the marker after a successful unlock read', async () => {
    await expect(disable()).resolves.toEqual({ok: true});

    expect(keychain.getGenericPassword).toHaveBeenCalledTimes(1);
    expect(keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
    expect(
      keychain.getGenericPassword.mock.invocationCallOrder[0],
    ).toBeLessThan(keychain.resetGenericPassword.mock.invocationCallOrder[0]);
  });

  it.each([
    ['the prompt is cancelled', {code: '-128'}, 'cancelled'],
    ['the prompt fails', new Error('boom'), 'failed'],
  ])('keeps the marker when %s', async (_label, error, reason) => {
    keychain.getGenericPassword.mockRejectedValueOnce(error);

    await expect(disable()).resolves.toEqual({ok: false, reason});
    expect(keychain.resetGenericPassword).not.toHaveBeenCalled();
  });

  it('keeps the marker when the read returns the wrong username', async () => {
    keychain.getGenericPassword.mockResolvedValueOnce(
      marker({username: 'x'}) as never,
    );

    await expect(disable()).resolves.toEqual({ok: false, reason: 'failed'});
    expect(keychain.resetGenericPassword).not.toHaveBeenCalled();
  });

  it.each([
    [
      'resolves false',
      () => keychain.resetGenericPassword.mockResolvedValueOnce(false),
    ],
    [
      'rejects',
      () =>
        keychain.resetGenericPassword.mockRejectedValueOnce(
          new Error('reset failed'),
        ),
    ],
  ])('reports failure when the removal %s', async (_label, arrange) => {
    arrange();

    await expect(disable()).resolves.toEqual({ok: false, reason: 'failed'});
  });
});

describe('isArmed', () => {
  it('reports an existing marker without reading it', async () => {
    await expect(isArmed()).resolves.toBe(true);
    expect(keychain.getGenericPassword).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no marker',
      () => keychain.hasGenericPassword.mockResolvedValueOnce(false),
    ],
    [
      'a non-boolean answer',
      () => keychain.hasGenericPassword.mockResolvedValueOnce('yes' as never),
    ],
    [
      'a failed check',
      () =>
        keychain.hasGenericPassword.mockRejectedValueOnce(new Error('boom')),
    ],
  ])('answers false for %s', async (_label, arrange) => {
    arrange();

    await expect(isArmed()).resolves.toBe(false);
  });
});

describe('keychain mock', () => {
  it('uses the enum values the real library sends to native code', () => {
    const actual = jest.requireActual('react-native-keychain');

    expect(Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE).toBe(
      actual.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    );
    expect(Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY).toBe(
      actual.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    );
    expect(Keychain.STORAGE_TYPE.AES_GCM).toBe(actual.STORAGE_TYPE.AES_GCM);
    expect(Keychain.BIOMETRY_TYPE).toEqual(actual.BIOMETRY_TYPE);
  });
});
