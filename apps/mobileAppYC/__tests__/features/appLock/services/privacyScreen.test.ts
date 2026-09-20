import {NativeModules} from 'react-native';

import {
  coverRendered,
  dismissSystemSheets,
  monotonicNow,
  setPrivacy,
} from '@/features/appLock/services/privacyScreen';

const modules = NativeModules as Record<string, unknown>;

const makeModule = () => ({
  monotonicNow: jest.fn().mockResolvedValue(123_456),
  setPrivacy: jest.fn().mockResolvedValue(true),
  coverRendered: jest.fn().mockResolvedValue(true),
  dismissSystemSheets: jest.fn().mockResolvedValue(true),
});

afterEach(() => {
  delete modules.AppLock;
});

describe('with the AppLock native module present', () => {
  let native: ReturnType<typeof makeModule>;

  beforeEach(() => {
    native = makeModule();
    modules.AppLock = native;
  });

  it('reads the monotonic clock', async () => {
    await expect(monotonicNow()).resolves.toBe(123_456);
    expect(native.monotonicNow).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a string', '123'],
    ['undefined', undefined],
  ])('answers null when the clock returns %s', async (_label, value) => {
    native.monotonicNow.mockResolvedValueOnce(value);

    await expect(monotonicNow()).resolves.toBeNull();
  });

  it('passes the flag and the timeout to setPrivacy', async () => {
    await expect(setPrivacy(true, 60_000)).resolves.toBe(true);
    await expect(setPrivacy(false, 0)).resolves.toBe(true);

    expect(native.setPrivacy).toHaveBeenNthCalledWith(1, true, 60_000);
    expect(native.setPrivacy).toHaveBeenNthCalledWith(2, false, 0);
  });

  it('rounds a fractional timeout down', async () => {
    await setPrivacy(true, 60_000.9);

    expect(native.setPrivacy).toHaveBeenCalledWith(true, 60_000);
  });

  it.each([
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('sends a %s timeout as immediately', async (_label, timeoutMs) => {
    await setPrivacy(true, timeoutMs);

    expect(native.setPrivacy).toHaveBeenCalledWith(true, 0);
  });

  it('tells native code the JS cover has drawn', async () => {
    await expect(coverRendered()).resolves.toBe(true);
    expect(native.coverRendered).toHaveBeenCalledTimes(1);
  });

  it('asks native code to close system sheets', async () => {
    await expect(dismissSystemSheets()).resolves.toBe(true);
    expect(native.dismissSystemSheets).toHaveBeenCalledTimes(1);
  });

  it('passes through a false answer from native code', async () => {
    native.setPrivacy.mockResolvedValueOnce(false);
    native.dismissSystemSheets.mockResolvedValueOnce(false);

    await expect(setPrivacy(true, 60_000)).resolves.toBe(false);
    await expect(dismissSystemSheets()).resolves.toBe(false);
  });

  it('falls back when a native call rejects', async () => {
    native.monotonicNow.mockRejectedValueOnce(new Error('boom'));
    native.setPrivacy.mockRejectedValueOnce(new Error('boom'));
    native.coverRendered.mockRejectedValueOnce('not an error');
    native.dismissSystemSheets.mockRejectedValueOnce(new Error('boom'));

    await expect(monotonicNow()).resolves.toBeNull();
    await expect(setPrivacy(true, 60_000)).resolves.toBe(false);
    await expect(coverRendered()).resolves.toBe(false);
    await expect(dismissSystemSheets()).resolves.toBe(false);
  });

  it('falls back when a native call throws synchronously', async () => {
    native.setPrivacy.mockImplementationOnce(() => {
      throw new Error('bridge gone');
    });

    await expect(setPrivacy(true, 60_000)).resolves.toBe(false);
  });
});

describe('without the AppLock native module', () => {
  it('answers the fallbacks instead of throwing', async () => {
    expect(modules.AppLock).toBeUndefined();

    await expect(monotonicNow()).resolves.toBeNull();
    await expect(setPrivacy(true, 60_000)).resolves.toBe(false);
    await expect(coverRendered()).resolves.toBe(false);
    await expect(dismissSystemSheets()).resolves.toBe(false);
  });

  it('reads the module at call time, so one registered later is used', async () => {
    await expect(monotonicNow()).resolves.toBeNull();

    modules.AppLock = makeModule();

    await expect(monotonicNow()).resolves.toBe(123_456);
  });
});
