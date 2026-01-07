import {Platform, Alert, ToastAndroid} from 'react-native';
import {showPermissionDeniedToast} from '../../src/shared/utils/permissionToast';

// Mock Alert and ToastAndroid
jest.spyOn(Alert, 'alert');
jest.spyOn(ToastAndroid, 'show');

describe('showPermissionDeniedToast', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    // Reset to Android by default
    (Platform as any).OS = 'android';
  });

  it('shows ToastAndroid on Android', () => {
    // Ensure Platform.OS is 'android'
    (Platform as any).OS = 'android';

    const label = 'Photos';
    const expectedMessage = `You don't have access to ${label}. Ask the primary parent to enable it.`;

    showPermissionDeniedToast(label);

    // Verify ToastAndroid was called
    expect(ToastAndroid.show).toHaveBeenCalledWith(
      expectedMessage,
      ToastAndroid.SHORT,
    );
    // Verify Alert was NOT called
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows Alert on iOS', () => {
    // Override Platform.OS to 'ios'
    (Platform as any).OS = 'ios';

    const label = 'Documents';
    const expectedMessage = `You don't have access to ${label}. Ask the primary parent to enable it.`;

    showPermissionDeniedToast(label);

    // Verify Alert was called
    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission needed',
      expectedMessage,
    );
    // Verify ToastAndroid was NOT called
    expect(ToastAndroid.show).not.toHaveBeenCalled();
  });
});