import { provisionPendingSignUpUser } from '@/app/features/auth/services/provisioning';
import { postData } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

const mockPostData = postData as jest.Mock;
const mockGetState = useAuthStore.getState as jest.Mock;

describe('provisionPendingSignUpUser', () => {
  const mockClearPendingSignUp = jest.fn();

  const withPendingSignUp = (pendingSignUp: unknown) => {
    mockGetState.mockReturnValue({
      pendingSignUp,
      clearPendingSignUp: mockClearPendingSignUp,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when there is no pending sign-up', async () => {
    withPendingSignUp(null);

    await provisionPendingSignUpUser();

    expect(mockPostData).not.toHaveBeenCalled();
    expect(mockClearPendingSignUp).not.toHaveBeenCalled();
  });

  it('provisions the user with the stored name and role, then clears the draft', async () => {
    withPendingSignUp({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
    });
    mockPostData.mockResolvedValue({ data: {} });

    await provisionPendingSignUpUser();

    expect(mockPostData).toHaveBeenCalledWith('/fhir/v1/user', {
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
    });
    expect(mockClearPendingSignUp).toHaveBeenCalled();
  });

  it('treats an already-provisioned user (409) as success', async () => {
    withPendingSignUp({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
    });
    mockPostData.mockRejectedValue({ response: { status: 409 } });

    await expect(provisionPendingSignUpUser()).resolves.toBeUndefined();

    expect(mockClearPendingSignUp).toHaveBeenCalled();
  });

  it('rethrows other failures and keeps the pending draft', async () => {
    withPendingSignUp({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
    });
    mockPostData.mockRejectedValue({ response: { status: 500 } });

    await expect(provisionPendingSignUpUser()).rejects.toEqual({ response: { status: 500 } });

    expect(mockClearPendingSignUp).not.toHaveBeenCalled();
  });

  it('rethrows failures without a response status', async () => {
    withPendingSignUp({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'member',
    });
    mockPostData.mockRejectedValue(new Error('network down'));

    await expect(provisionPendingSignUpUser()).rejects.toThrow('network down');

    expect(mockClearPendingSignUp).not.toHaveBeenCalled();
  });
});
