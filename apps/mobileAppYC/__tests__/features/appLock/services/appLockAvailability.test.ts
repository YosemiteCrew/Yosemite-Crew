import {Platform} from 'react-native';
import * as Keychain from 'react-native-keychain';
import {getAppLockAvailability} from '@/features/appLock/services/appLockAvailability';

jest.mock('react-native-keychain', () => ({
  __esModule: true,
  getSupportedBiometryType: jest.fn(),
  isPasscodeAuthAvailable: jest.fn(),
  BIOMETRY_TYPE: {
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
    OPTIC_ID: 'OpticID',
    FINGERPRINT: 'Fingerprint',
  },
}));

describe('getAppLockAvailability', () => {
  const originalPlatform = Platform.OS;
  const biometry = Keychain.getSupportedBiometryType as jest.Mock;
  const passcode = Keychain.isPasscodeAuthAvailable as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterAll(() => {
    jest.replaceProperty(Platform, 'OS', originalPlatform);
  });

  it('allows a device with a passcode', async () => {
    biometry.mockResolvedValue(null);
    passcode.mockResolvedValue(true);
    await expect(getAppLockAvailability()).resolves.toEqual({
      result: {available: true},
      method: 'passcode',
    });
  });

  it('reports a device without a security check as unavailable', async () => {
    biometry.mockResolvedValue(null);
    passcode.mockResolvedValue(false);
    await expect(getAppLockAvailability()).resolves.toEqual({
      result: {available: false, reason: 'noPasscode'},
      method: null,
    });
  });

  it('fails closed when the keychain probe throws', async () => {
    biometry.mockRejectedValue(new Error('unavailable'));
    passcode.mockResolvedValue(true);
    await expect(getAppLockAvailability()).resolves.toEqual({
      result: {available: false, reason: 'noPasscode'},
      method: null,
    });
  });

  it('accepts Android fingerprint support', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    Object.defineProperty(Platform, 'Version', {value: 33, configurable: true});
    biometry.mockResolvedValue('Fingerprint');
    passcode.mockResolvedValue(true);
    await expect(getAppLockAvailability()).resolves.toEqual({
      result: {available: true},
      method: 'fingerprint',
    });
  });

  it('reports old Android without strong biometrics as unavailable', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    Object.defineProperty(Platform, 'Version', {value: 29, configurable: true});
    biometry.mockResolvedValue(null);
    passcode.mockResolvedValue(false);
    await expect(getAppLockAvailability()).resolves.toEqual({
      result: {available: false, reason: 'androidVersion'},
      method: null,
    });
  });
});
