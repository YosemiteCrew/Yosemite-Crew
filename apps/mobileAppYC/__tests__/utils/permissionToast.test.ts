import {Alert, ToastAndroid} from 'react-native';
import {showPermissionDeniedToast} from '../../src/shared/utils/permissionToast';

// Define a mutable Platform mock
const mockPlatform = {
  OS: 'android' as 'ios' | 'android', // Default, will be overridden in tests
  select: jest.fn(),
};

// Mock React Native Platform at the Libraries path
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: mockPlatform,
  ...mockPlatform,
}));

// Mock React Native components
jest.mock('react-native', () => {
  return {
    Platform: mockPlatform,
    ToastAndroid: {
      show: jest.fn(),
      SHORT: 'SHORT_DURATION',
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

describe('showPermissionDeniedToast', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('shows ToastAndroid on Android', () => {
    // Override Platform.OS to 'android'
    mockPlatform.OS = 'android';

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
    mockPlatform.OS = 'ios';

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