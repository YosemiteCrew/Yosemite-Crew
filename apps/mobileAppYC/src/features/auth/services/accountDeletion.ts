import {deleteUser as amplifyDeleteUser} from 'aws-amplify/auth';
import {deleteUser, getAuth} from '@react-native-firebase/auth';

export const deleteAmplifyAccount = async (): Promise<void> => {
  try {
    await amplifyDeleteUser();
    console.log('[Auth] Amplify account deleted successfully');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to delete Amplify account.';
    console.warn('[Auth] Amplify account deletion failed', message);
    throw new Error(message);
  }
};

export const deleteFirebaseAccount = async (): Promise<void> => {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.warn('[Auth] No Firebase user present during account deletion');
      return;
    }

    await deleteUser(currentUser);
    console.log('[Auth] Firebase account deleted successfully');
  } catch (error) {
    const code = (error as any)?.code;
    const message =
      code === 'auth/requires-recent-login'
        ? 'Please log in again before deleting your account.'
        : error instanceof Error
          ? error.message
          : 'Unable to delete Firebase account.';
    console.warn('[Auth] Firebase account deletion failed', message);
    throw new Error(message);
  }
};
