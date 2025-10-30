import { renderHook, act } from '@testing-library/react-hooks';
import { DeviceEventEmitter } from 'react-native'; // Import comes first
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocialAuth } from '@/features/auth/hooks/useSocialAuth';
import { signInWithSocialProvider } from '@/features/auth/services/socialAuth';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';

// --- Mocks ---

// Mock the core social auth service
jest.mock('@/features/auth/services/socialAuth', () => ({
  signInWithSocialProvider: jest.fn(),
}));
const mockedSignInWithSocialProvider =
  signInWithSocialProvider as jest.MockedFunction<typeof signInWithSocialProvider>;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// CORRECTED MOCK for DeviceEventEmitter
jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    emit: jest.fn(),
  },
}));
const mockedDeviceEventEmitter = DeviceEventEmitter as jest.Mocked<
  typeof DeviceEventEmitter
>;

// --- Mock Data ---

type MockAuthResult = Awaited<ReturnType<typeof signInWithSocialProvider>>;

const mockBaseResult: MockAuthResult = {
  user: { id: 'user-123', email: 'test@example.com' },
  tokens: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    idToken: 'id-token', // Added missing 'idToken'
  },
  profile: {
    profileToken: 'profile-token',
    exists: false,
    // FIXED: Use 'as any' to bypass the specific ProfileStatusSource type check
    source: 'google.com' as any,
  },
  initialAttributes: {
    firstName: 'Test',
    lastName: 'User',
    profilePicture: 'http://example.com/img.png',
  },
};

const mockExistingProfileResult: MockAuthResult = {
  ...mockBaseResult,
  profile: {
    ...mockBaseResult.profile,
    exists: true,
  },
};

const mockNewProfileResult: MockAuthResult = {
  ...mockBaseResult,
  profile: {
    ...mockBaseResult.profile,
    exists: false,
  },
};

const mockCreateAccountPayload: AuthStackParamList['CreateAccount'] = {
  email: mockNewProfileResult.user.email,
  userId: mockNewProfileResult.user.id,
  profileToken: mockNewProfileResult.profile.profileToken,
  tokens: mockNewProfileResult.tokens,
  initialAttributes: {
    firstName: mockNewProfileResult.initialAttributes.firstName,
    lastName: mockNewProfileResult.initialAttributes.lastName,
    profilePicture: mockNewProfileResult.initialAttributes.profilePicture,
  },
};

// --- Test Suite ---

describe('useSocialAuth', () => {
  const mockOnExistingProfile = jest.fn();
  const mockOnNewProfile = jest.fn();
  const mockOnStart = jest.fn();
  const genericErrorMessage = 'Something went wrong.';
  const cancelledMessage = 'Auth cancelled.';

  const defaultProps = {
    onExistingProfile: mockOnExistingProfile,
    onNewProfile: mockOnNewProfile,
    onStart: mockOnStart,
    genericErrorMessage,
    cancelledMessage,
  };

  beforeEach(() => {
    // Reset all mock functions before each test
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should set activeProvider and isSocialLoading to true on start', async () => {
    // Mock the promise to keep it pending
    mockedSignInWithSocialProvider.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    // Call the handler
    act(() => {
      result.current.handleSocialAuth('google');
    });

    // Check state immediately
    expect(result.current.activeProvider).toBe('google');
    expect(result.current.isSocialLoading).toBe(true);
    expect(mockOnStart).toHaveBeenCalledTimes(1);
  });

  it('should not start a new auth flow if one is already active', async () => {
    mockedSignInWithSocialProvider.mockReturnValue(new Promise(() => {})); // Keep it pending
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    // Start first flow
    act(() => {
      result.current.handleSocialAuth('google');
    });

    expect(result.current.isSocialLoading).toBe(true);
    expect(mockOnStart).toHaveBeenCalledTimes(1);

    // Try to start second flow
    await act(async () => {
      await result.current.handleSocialAuth('apple');
    });

    // Should not have called onStart again, and provider should still be 'google'
    expect(mockOnStart).toHaveBeenCalledTimes(1);
    expect(mockedSignInWithSocialProvider).toHaveBeenCalledTimes(1);
    expect(mockedSignInWithSocialProvider).toHaveBeenCalledWith('google');
    expect(result.current.activeProvider).toBe('google');
  });

  it('should handle an existing profile successfully', async () => {
    mockedSignInWithSocialProvider.mockResolvedValue(mockExistingProfileResult);
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    await act(async () => {
      await result.current.handleSocialAuth('google');
    });

    expect(mockOnStart).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(PENDING_PROFILE_STORAGE_KEY);
    expect(mockedDeviceEventEmitter.emit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
    expect(mockOnExistingProfile).toHaveBeenCalledWith(mockExistingProfileResult);
    expect(mockOnNewProfile).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();

    // Check final state
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should handle a new profile successfully', async () => {
    mockedSignInWithSocialProvider.mockResolvedValue(mockNewProfileResult);
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    await act(async () => {
      await result.current.handleSocialAuth('apple');
    });

    expect(mockOnStart).toHaveBeenCalledTimes(1);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      PENDING_PROFILE_STORAGE_KEY,
      JSON.stringify(mockCreateAccountPayload),
    );
    expect(mockedDeviceEventEmitter.emit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
    expect(mockOnNewProfile).toHaveBeenCalledWith(mockCreateAccountPayload);
    expect(mockOnExistingProfile).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.removeItem).not.toHaveBeenCalled();

    // Check final state
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should throw generic error message on a generic error', async () => {
    const error = new Error('Generic fail');
    mockedSignInWithSocialProvider.mockRejectedValue(error);
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    await expect(
      act(async () => {
        await result.current.handleSocialAuth('google');
      }),
    ).rejects.toThrow(genericErrorMessage);

    expect(mockOnStart).toHaveBeenCalledTimes(1);
    expect(mockOnNewProfile).not.toHaveBeenCalled();
    expect(mockOnExistingProfile).not.toHaveBeenCalled();

    // Check final state
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should throw cancelled error message if error code is "auth/cancelled"', async () => {
    const error = { code: 'auth/cancelled', message: 'Cancelled by user' };
    mockedSignInWithSocialProvider.mockRejectedValue(error);
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    await expect(
      act(async () => {
        await result.current.handleSocialAuth('google');
      }),
    ).rejects.toThrow(cancelledMessage);

    // Check final state
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should throw cancelled error message if error message contains "cancel"', async () => {
    const error = { message: 'User cancelled the flow' };
    mockedSignInWithSocialProvider.mockRejectedValue(error);
    const { result } = renderHook(() => useSocialAuth(defaultProps));

    await expect(
      act(async () => {
        await result.current.handleSocialAuth('google');
      }),
    ).rejects.toThrow(cancelledMessage);

    // Check final state
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.isSocialLoading).toBe(false);
  });

  it('should use default cancelled message if not provided', async () => {
    const error = { code: 'auth/cancelled' };
    mockedSignInWithSocialProvider.mockRejectedValue(error);
    // Render without cancelledMessage
    const { result } = renderHook(() => useSocialAuth({
      ...defaultProps,
      cancelledMessage: undefined, // Use default
    }));

    await expect(
      act(async () => {
        await result.current.handleSocialAuth('google');
      }),
    ).rejects.toThrow('Kindly retry.'); // The default message from the hook
  });

  it('should not call onStart if onStart prop is not provided', async () => {
    mockedSignInWithSocialProvider.mockResolvedValue(mockNewProfileResult);
    // Render without onStart
    const { result } = renderHook(() => useSocialAuth({
      ...defaultProps,
      onStart: undefined,
    }));

    await act(async () => {
      await result.current.handleSocialAuth('apple');
    });

    expect(mockOnStart).not.toHaveBeenCalled();
    expect(mockOnNewProfile).toHaveBeenCalled(); // Ensure flow completed
  });
});