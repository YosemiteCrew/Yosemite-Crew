import {
  deleteAmplifyAccount,
  deleteFirebaseAccount,
} from '../../../../src/features/auth/services/accountDeletion';

// --- Mocks ---

// 1. Mock AWS Amplify
// We mock the specific named export used in the file
jest.mock('aws-amplify/auth', () => ({
  deleteUser: jest.fn(),
}));

// 2. Mock React Native Firebase
// We mock getAuth and deleteUser
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  deleteUser: jest.fn(),
}));

// Import the mocks to control them in tests
import {deleteUser as amplifyDeleteUser} from 'aws-amplify/auth';
import {deleteUser as firebaseDeleteUser, getAuth} from '@react-native-firebase/auth';

describe('accountDeletion services', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // 1. deleteAmplifyAccount Tests
  // ==========================================
  describe('deleteAmplifyAccount', () => {
    it('successfully deletes amplify account', async () => {
      (amplifyDeleteUser as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(deleteAmplifyAccount()).resolves.not.toThrow();

      expect(amplifyDeleteUser).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        '[Auth] Amplify account deleted successfully',
      );
    });

    it('throws error when deletion fails (Standard Error)', async () => {
      const error = new Error('Network Error');
      (amplifyDeleteUser as jest.Mock).mockRejectedValueOnce(error);

      await expect(deleteAmplifyAccount()).rejects.toThrow('Network Error');

      expect(console.warn).toHaveBeenCalledWith(
        '[Auth] Amplify account deletion failed',
        'Network Error',
      );
    });

    it('throws default error message when error is not an instance of Error', async () => {
      const unknownError = 'Something weird';
      (amplifyDeleteUser as jest.Mock).mockRejectedValueOnce(unknownError);

      await expect(deleteAmplifyAccount()).rejects.toThrow(
        'Unable to delete Amplify account.',
      );

      expect(console.warn).toHaveBeenCalledWith(
        '[Auth] Amplify account deletion failed',
        'Unable to delete Amplify account.',
      );
    });
  });

  // ==========================================
  // 2. deleteFirebaseAccount Tests
  // ==========================================
  describe('deleteFirebaseAccount', () => {
    it('successfully deletes firebase account when user exists', async () => {
      const mockUser = {uid: '123'};
      // Mock getAuth to return an object with currentUser
      (getAuth as jest.Mock).mockReturnValue({currentUser: mockUser});
      (firebaseDeleteUser as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(deleteFirebaseAccount()).resolves.not.toThrow();

      expect(firebaseDeleteUser).toHaveBeenCalledWith(mockUser);
      expect(console.log).toHaveBeenCalledWith(
        '[Auth] Firebase account deleted successfully',
      );
    });

    it('handles case where no current user exists (logs warning, does not throw)', async () => {
      // Mock getAuth to return null currentUser
      (getAuth as jest.Mock).mockReturnValue({currentUser: null});

      await expect(deleteFirebaseAccount()).resolves.not.toThrow();

      // Should NOT attempt delete
      expect(firebaseDeleteUser).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        '[Auth] No Firebase user present during account deletion',
      );
    });

    it('handles "auth/requires-recent-login" specific error code', async () => {
      const mockUser = {uid: '123'};
      (getAuth as jest.Mock).mockReturnValue({currentUser: mockUser});

      // Create a mock error with the specific code property
      const sensitiveError: any = new Error('Auth error');
      sensitiveError.code = 'auth/requires-recent-login';
      (firebaseDeleteUser as jest.Mock).mockRejectedValueOnce(sensitiveError);

      await expect(deleteFirebaseAccount()).rejects.toThrow(
        'Please log in again before deleting your account.',
      );

      expect(console.warn).toHaveBeenCalledWith(
        '[Auth] Firebase account deletion failed',
        'Please log in again before deleting your account.',
      );
    });

    it('handles standard generic Error during deletion', async () => {
      const mockUser = {uid: '123'};
      (getAuth as jest.Mock).mockReturnValue({currentUser: mockUser});

      const genericError = new Error('Generic failure');
      (firebaseDeleteUser as jest.Mock).mockRejectedValueOnce(genericError);

      await expect(deleteFirebaseAccount()).rejects.toThrow('Generic failure');
    });

    it('handles unknown error types (not Error instance)', async () => {
      const mockUser = {uid: '123'};
      (getAuth as jest.Mock).mockReturnValue({currentUser: mockUser});

      (firebaseDeleteUser as jest.Mock).mockRejectedValueOnce('Unknown string error');

      await expect(deleteFirebaseAccount()).rejects.toThrow(
        'Unable to delete Firebase account.',
      );
    });
  });
});