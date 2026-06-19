import {
  createBiometricLock,
  detectPlatform,
  type BiometricPlatform,
} from '../src/lifecycle/biometric-lock';

describe('detectPlatform', () => {
  test('returns macos for darwin', () => {
    expect(detectPlatform('darwin')).toBe('macos');
  });

  test('returns windows for win32', () => {
    expect(detectPlatform('win32')).toBe('windows');
  });

  test('returns unsupported for linux', () => {
    expect(detectPlatform('linux')).toBe('unsupported');
  });

  test('returns unsupported for unknown platform', () => {
    expect(detectPlatform('android')).toBe('unsupported');
  });
});

describe('createBiometricLock', () => {
  test('isAvailable returns true when canPromptTouchID succeeds (macOS)', () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID: async () => true,
    });
    expect(lock.isAvailable()).toBe(true);
  });

  test('isAvailable returns false when canPromptTouchID returns false', () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => false,
      promptTouchID: async () => false,
    });
    expect(lock.isAvailable()).toBe(false);
  });

  test('isAvailable returns false when canPromptTouchID throws', () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => {
        throw new Error('no hardware');
      },
      promptTouchID: async () => false,
    });
    expect(lock.isAvailable()).toBe(false);
  });

  test('isAvailable returns false on Windows', () => {
    const lock = createBiometricLock({
      platform: 'windows',
    });
    expect(lock.isAvailable()).toBe(false);
  });

  test('isAvailable returns false on unsupported platform', () => {
    const lock = createBiometricLock({
      platform: 'unsupported',
    });
    expect(lock.isAvailable()).toBe(false);
  });

  test('authenticate returns true on success (macOS)', async () => {
    const promptTouchID = jest.fn(async () => true);
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID,
    });
    const result = await lock.authenticate('Unlock app');
    expect(result).toBe(true);
    expect(promptTouchID).toHaveBeenCalledWith('Unlock app');
  });

  test('authenticate returns false on failure (macOS)', async () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID: async () => false,
    });
    const result = await lock.authenticate();
    expect(result).toBe(false);
  });

  test('authenticate returns false when promptTouchID throws', async () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID: async () => {
        throw new Error('cancelled');
      },
    });
    const result = await lock.authenticate();
    expect(result).toBe(false);
  });

  test('authenticate returns false on Windows', async () => {
    const lock = createBiometricLock({ platform: 'windows' });
    const result = await lock.authenticate();
    expect(result).toBe(false);
  });

  test('authenticate returns false on unsupported platform', async () => {
    const lock = createBiometricLock({ platform: 'unsupported' });
    const result = await lock.authenticate();
    expect(result).toBe(false);
  });

  test('isLocked returns false initially', () => {
    const lock = createBiometricLock();
    expect(lock.isLocked()).toBe(false);
  });

  test('lock sets locked state', () => {
    const lock = createBiometricLock();
    lock.lock();
    expect(lock.isLocked()).toBe(true);
  });

  test('unlock clears locked state', () => {
    const lock = createBiometricLock();
    lock.lock();
    lock.unlock();
    expect(lock.isLocked()).toBe(false);
  });

  test('unlocking resets locked state after lock', () => {
    const lock = createBiometricLock();
    lock.lock();
    expect(lock.isLocked()).toBe(true);
    lock.unlock();
    expect(lock.isLocked()).toBe(false);
  });

  test('getPlatform returns the configured platform', () => {
    const lock = createBiometricLock({ platform: 'macos' });
    expect(lock.getPlatform()).toBe('macos');
  });

  test('getPlatform defaults to detected platform', () => {
    const lock = createBiometricLock();
    const expected: BiometricPlatform = process.platform === 'darwin' ? 'macos' : 'unsupported';
    expect(lock.getPlatform()).toBe(expected);
  });

  test('authenticate unlocks on success', async () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID: async () => true,
    });
    lock.lock();
    expect(lock.isLocked()).toBe(true);
    const result = await lock.authenticate();
    expect(result).toBe(true);
    expect(lock.isLocked()).toBe(false);
  });

  test('authenticate does not unlock on failure', async () => {
    const lock = createBiometricLock({
      platform: 'macos',
      canPromptTouchID: () => true,
      promptTouchID: async () => false,
    });
    lock.lock();
    const result = await lock.authenticate();
    expect(result).toBe(false);
    expect(lock.isLocked()).toBe(true);
  });
});
