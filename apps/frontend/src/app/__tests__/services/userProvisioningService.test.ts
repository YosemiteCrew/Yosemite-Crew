import { provisionBackendUser } from '@/app/features/auth/services/userProvisioningService';
import { isAuthRedirectError, postData } from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';

jest.mock('@/app/services/axios', () => ({
  postData: jest.fn(),
  isAuthRedirectError: jest.fn(() => false),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: { getState: jest.fn(() => ({ pendingSignUp: null })) },
}));

const mockGetState = useAuthStore.getState as unknown as jest.Mock;

describe('provisionBackendUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetState.mockReturnValue({ pendingSignUp: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns true on first success and sends no body without a pending sign-up', async () => {
    (postData as jest.Mock).mockResolvedValue({});

    await expect(provisionBackendUser()).resolves.toBe(true);
    expect(postData).toHaveBeenCalledTimes(1);
    expect(postData).toHaveBeenCalledWith('/fhir/v1/user', undefined);
  });

  it('sends the pending sign-up name and role so the backend can persist it', async () => {
    mockGetState.mockReturnValue({
      pendingSignUp: { firstName: 'Ada', lastName: 'Lovelace', role: 'developer' },
    });
    (postData as jest.Mock).mockResolvedValue({});

    await expect(provisionBackendUser()).resolves.toBe(true);
    expect(postData).toHaveBeenCalledWith('/fhir/v1/user', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'developer',
    });
  });

  it('retries with backoff after a transient failure and succeeds', async () => {
    (postData as jest.Mock)
      .mockRejectedValueOnce(new Error('503 cold start'))
      .mockResolvedValueOnce({});

    const promise = provisionBackendUser();
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe(true);
    expect(postData).toHaveBeenCalledTimes(2);
  });

  it('returns false after exhausting all attempts', async () => {
    (postData as jest.Mock).mockRejectedValue(new Error('persistent failure'));

    const promise = provisionBackendUser();
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(promise).resolves.toBe(false);
    expect(postData).toHaveBeenCalledTimes(3);
  });

  it('rethrows auth-loss errors without retrying', async () => {
    const authError = new Error('Authentication required');
    (postData as jest.Mock).mockRejectedValue(authError);
    (isAuthRedirectError as unknown as jest.Mock).mockReturnValue(true);

    await expect(provisionBackendUser()).rejects.toThrow('Authentication required');
    expect(postData).toHaveBeenCalledTimes(1);
  });
});
