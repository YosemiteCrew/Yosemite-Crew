import {Platform} from 'react-native';
import * as Keychain from 'react-native-keychain';
import {
  availability,
  methodFromBiometry,
  type AppLockAvailability,
} from '../appLockLogic';

export const getAppLockAvailability = async (): Promise<{
  result: AppLockAvailability;
  method: string | null;
}> => {
  try {
    const [biometry, canCheck] = await Promise.all([
      Keychain.getSupportedBiometryType(),
      Keychain.isPasscodeAuthAvailable(),
    ]);
    const result = availability({
      platform: Platform.OS,
      apiLevel: typeof Platform.Version === 'number' ? Platform.Version : 0,
      hasPasscode: canCheck,
      hasStrongBiometrics: biometry !== null,
    });
    return {
      result,
      method: methodFromBiometry(biometry, Platform.OS, canCheck),
    };
  } catch {
    return {result: {available: false, reason: 'noPasscode'}, method: null};
  }
};
