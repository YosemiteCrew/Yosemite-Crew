import {
  getData,
  postData,
  putData,
  deleteData,
  patchData,
  isAuthRedirectError,
} from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { logger } from '@/app/lib/logger';
import axios from 'axios';

// --- Mocks ---

// Mock Auth Store
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Axios
jest.mock('axios', () => {
  // Define mocks INSIDE the factory to avoid ReferenceError/Hoisting issues
  const mockRequestUse = jest.fn();
  const mockResponseUse = jest.fn();

  const mockInstance = jest.fn().mockImplementation((config) => {
    return Promise.resolve({ data: 'retried data', config });
  }) as any;

  // Add methods to the mock instance
  mockInstance.get = jest.fn();
  mockInstance.post = jest.fn();
  mockInstance.put = jest.fn();
  mockInstance.delete = jest.fn();
  mockInstance.patch = jest.fn();

  // Attach interceptor mocks
  mockInstance.interceptors = {
    request: { use: mockRequestUse },
    response: { use: mockResponseUse },
  };
  mockInstance.defaults = { headers: {} };

  return {
    create: jest.fn(() => mockInstance),
    isAxiosError: jest.fn((payload) => payload?.isAxiosError),
    // Expose the internal mock instance to access it in tests
    _mockInstance: mockInstance,
  };
});

describe('Axios Service', () => {
  const mockGetState = useAuthStore.getState as jest.Mock;
  const mockOrgGetState = useOrgStore.getState as jest.Mock;

  // Access the mocked instance exposed in the factory above
  const mockAxiosInstance = (axios as any)._mockInstance;
  const mockRequestUse = mockAxiosInstance.interceptors.request.use;
  const mockResponseUse = mockAxiosInstance.interceptors.response.use;

  // Variables to hold the actual callbacks passed to interceptors
  let requestSuccessHandler: any;
  let requestErrorHandler: any;
  let responseSuccessHandler: any;
  let responseErrorHandler: any;

  beforeAll(() => {
    // Check if use was called
    expect(mockRequestUse).toHaveBeenCalled();
    expect(mockResponseUse).toHaveBeenCalled();

    // Extract the handlers so we can invoke them in tests
    // Ensure we have handlers to extract
    if (mockRequestUse.mock.calls.length > 0) {
      [requestSuccessHandler, requestErrorHandler] = mockRequestUse.mock.calls[0];
    }
    if (mockResponseUse.mock.calls.length > 0) {
      [responseSuccessHandler, responseErrorHandler] = mockResponseUse.mock.calls[0];
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.window.history.replaceState({}, '', '/');
    mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-1', clearOrgs: jest.fn() });
  });

  // --- Helper Functions Tests ---

  // The instance is created once at module import, before beforeEach clears
  // mocks — capture the create config in beforeAll so the assertion survives.
  let createConfig: { timeout?: number } | undefined;
  beforeAll(() => {
    createConfig = (axios.create as jest.Mock).mock.calls[0]?.[0];
  });

  it('creates the api instance with a generous timeout for slow backends', () => {
    expect(createConfig).toEqual(expect.objectContaining({ timeout: 60_000 }));
  });

  describe('Wrapper Methods', () => {
    it('getData calls api.get', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: 'ok' });
      await getData('/test', { id: 1 });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { params: { id: 1 } });
    });

    it('getData reuses an identical in-flight GET request', async () => {
      let resolveRequest: (value: { data: string }) => void = () => {};
      const requestPromise = new Promise<{ data: string }>((resolve) => {
        resolveRequest = resolve;
      });

      mockAxiosInstance.get.mockReturnValueOnce(requestPromise);

      const firstRequest = getData('/deduped', { b: 2, a: 1 });
      const secondRequest = getData('/deduped', { a: 1, b: 2 });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      resolveRequest({ data: 'ok' });
      await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
        { data: 'ok' },
        { data: 'ok' },
      ]);
    });

    it('getData builds stable dedupe keys for nested GET params', async () => {
      let resolveRequest: (value: { data: string }) => void = () => {};
      const requestPromise = new Promise<{ data: string }>((resolve) => {
        resolveRequest = resolve;
      });

      mockAxiosInstance.get.mockReturnValueOnce(requestPromise);

      const firstRequest = getData('/nested-deduped', {
        filters: [undefined, null, new Date('2026-05-09T00:00:00.000Z')],
        query: new URLSearchParams('b=2&a=1'),
      });
      const secondRequest = getData('/nested-deduped', {
        query: new URLSearchParams('b=2&a=1'),
        filters: [undefined, null, new Date('2026-05-09T00:00:00.000Z')],
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      resolveRequest({ data: 'ok' });
      await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
        { data: 'ok' },
        { data: 'ok' },
      ]);
    });

    it('getData does not reuse in-flight GET requests across organisations', async () => {
      let resolveFirstRequest: (value: { data: string }) => void = () => {};
      const firstPromise = new Promise<{ data: string }>((resolve) => {
        resolveFirstRequest = resolve;
      });
      const secondPromise = Promise.resolve({ data: 'org-2' });

      mockAxiosInstance.get.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      const firstRequest = getData('/org-scoped', { id: 1 });
      mockOrgGetState.mockReturnValue({ primaryOrgId: 'org-2' });
      const secondRequest = getData('/org-scoped', { id: 1 });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);

      resolveFirstRequest({ data: 'org-1' });
      await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
        { data: 'org-1' },
        { data: 'org-2' },
      ]);
    });

    it('getData allows callers to opt out of in-flight request deduplication', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      await Promise.all([
        getData('/not-deduped', { id: 1 }, { dedupe: false }),
        getData('/not-deduped', { id: 1 }, { dedupe: false }),
      ]);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('getData does not dedupe abortable requests', async () => {
      const signal = new AbortController().signal;
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      await Promise.all([getData('/abortable', { signal }), getData('/abortable', { signal })]);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('getData clears failed in-flight requests before retrying', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('temporary fail'))
        .mockResolvedValueOnce({ data: 'ok' });

      await expect(getData('/retry-after-failure')).rejects.toThrow('temporary fail');
      await expect(getData('/retry-after-failure')).resolves.toEqual({ data: 'ok' });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('getData handles errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('fail'));
      await expect(getData('/test')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith('API getData error:', expect.any(Error));
    });

    it('getData suppresses configured error statuses', async () => {
      const error = { response: { status: 404 } };
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(getData('/missing', {}, { suppressStatuses: [404] })).rejects.toEqual(error);

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('postData calls api.post', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: 'ok' });
      await postData('/test', { foo: 'bar' });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', { foo: 'bar' }, {});
    });

    it('postData handles errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('fail'));
      await expect(postData('/test')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith('API postData error:', expect.any(Error));
    });

    it('putData calls api.put', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: 'ok' });
      await putData('/test', { foo: 'bar' });
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test', { foo: 'bar' });
    });

    it('putData handles errors', async () => {
      mockAxiosInstance.put.mockRejectedValue(new Error('fail'));
      await expect(putData('/test')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith('API putData error:', expect.any(Error));
    });

    it('deleteData calls api.delete', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: 'ok' });
      await deleteData('/test', { id: 1 });
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test', { params: { id: 1 } });
    });

    it('deleteData handles errors', async () => {
      mockAxiosInstance.delete.mockRejectedValue(new Error('fail'));
      await expect(deleteData('/test')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith('API deleteData error:', expect.any(Error));
    });

    it('patchData calls api.patch', async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: 'ok' });
      await patchData('/test', { foo: 'bar' });
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test', { foo: 'bar' }, {});
    });

    it('patchData handles errors', async () => {
      mockAxiosInstance.patch.mockRejectedValue(new Error('fail'));
      await expect(patchData('/test')).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalledWith('API patchData error:', expect.any(Error));
    });
  });

  // --- Request Interceptor Tests ---

  describe('Request Interceptor', () => {
    it('adds Authorization header if session exists', async () => {
      const mockToken = 'mock-jwt';
      const mockSession = {
        getIdToken: () => ({ getJwtToken: () => mockToken }),
      };

      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(mockSession),
      });

      const config = { headers: {} };
      const result = await requestSuccessHandler(config);

      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('adds the active organisation header when available', async () => {
      const mockSession = {
        getIdToken: () => ({ getJwtToken: () => 'mock-jwt' }),
      };

      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(mockSession),
      });

      const config = { headers: {} };
      const result = await requestSuccessHandler(config);

      expect(result.headers['x-org-id']).toBe('org-1');
    });

    it('removes auth and organisation headers when session and organisation are unavailable', async () => {
      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(null),
      });
      mockOrgGetState.mockReturnValue({ primaryOrgId: undefined, clearOrgs: jest.fn() });

      const config = {
        headers: {
          Authorization: 'Bearer old-token',
          'x-org-id': 'old-org',
        },
      };
      const result = await requestSuccessHandler(config);

      expect(result.headers.Authorization).toBeUndefined();
      expect(result.headers['x-org-id']).toBeUndefined();
    });

    it('does not require headers on the request config', async () => {
      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(null),
      });

      const config = {};
      await expect(requestSuccessHandler(config)).resolves.toBe(config);
    });

    it('does not add Authorization header if no session', async () => {
      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(null),
      });

      const config = { headers: {} };
      const result = await requestSuccessHandler(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('rejects protected API requests before hitting the backend when auth is gone', async () => {
      const mockSignout = jest.fn().mockResolvedValue(undefined);
      globalThis.window.history.replaceState({}, '', '/appointments');
      mockGetState.mockReturnValue({
        status: 'unauthenticated',
        getValidSession: jest.fn().mockResolvedValue(null),
        signout: mockSignout,
      });

      try {
        await requestSuccessHandler({ url: '/fhir/v1/appointments', headers: {} });
        throw new Error('Expected request interceptor to reject');
      } catch (error) {
        expect(isAuthRedirectError(error)).toBe(true);
      }

      expect(mockSignout).toHaveBeenCalledTimes(1);
    });

    it('allows public API requests without a session', async () => {
      mockGetState.mockReturnValue({
        status: 'unauthenticated',
        getValidSession: jest.fn().mockResolvedValue(null),
      });

      const config = { url: '/v1/contact-us/contact-web', headers: {} };
      await expect(requestSuccessHandler(config)).resolves.toBe(config);
    });

    it('logs warning if accessing store fails', async () => {
      // Simulate error accessing state
      mockGetState.mockImplementationOnce(() => {
        throw new Error('Store Error');
      });

      const config = { headers: {} };
      await requestSuccessHandler(config);

      expect(logger.warn).toHaveBeenCalledWith(
        'No valid Cognito session available from AuthStore',
        expect.any(Error)
      );
    });

    it('handles request errors', async () => {
      const error = new Error('Request Fail');
      await expect(requestErrorHandler(error)).rejects.toThrow('Request Fail');
    });

    it('handles request errors that are not instances of Error', async () => {
      await expect(requestErrorHandler('String Error')).rejects.toThrow('String Error');
    });
  });

  // --- Response Interceptor Tests ---

  describe('Response Interceptor', () => {
    it('passes through successful responses', () => {
      const response = { data: 'success' };
      expect(responseSuccessHandler(response)).toEqual(response);
    });

    it('throws non-retryable errors immediately for idempotent reads', async () => {
      const error = {
        response: { status: 400 },
        config: { method: 'get' },
      };
      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it('does not retry transient failures on non-idempotent writes', async () => {
      const error = {
        response: { status: 429 },
        config: { method: 'post' },
      };
      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it('retries idempotent reads on rate-limit (429) with backoff', async () => {
      const error = {
        response: { status: 429, headers: { 'retry-after': '0' } },
        config: { method: 'get' },
      };
      mockAxiosInstance.mockResolvedValueOnce({ data: 'recovered' });

      const result = await responseErrorHandler(error);

      expect(mockAxiosInstance).toHaveBeenCalledTimes(1);
      expect((error.config as { _transientRetryCount?: number })._transientRetryCount).toBe(1);
      expect(result).toEqual({ data: 'recovered' });
    });

    it('gives up after the maximum transient retries', async () => {
      const error = {
        response: { status: 503, headers: { 'retry-after': '0' } },
        config: { method: 'get', _transientRetryCount: 3 },
      };
      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it('logs out and throws if request has already been retried', async () => {
      const mockSignout = jest.fn();
      mockGetState.mockReturnValue({ signout: mockSignout });

      const error = {
        response: { status: 401 },
        config: { _retry: true },
      };

      try {
        await responseErrorHandler(error);
        throw new Error('Expected response interceptor to reject');
      } catch (caughtError) {
        expect(isAuthRedirectError(caughtError)).toBe(true);
      }
      expect(mockSignout).toHaveBeenCalled();
    });

    it('refreshes session and retries request on 401', async () => {
      const mockSignout = jest.fn();
      const mockToken = 'new-jwt';
      const mockSession = {
        getIdToken: () => ({ getJwtToken: () => mockToken }),
      };
      const mockGetValidSession = jest.fn().mockResolvedValue(mockSession);

      mockGetState.mockReturnValue({
        getValidSession: mockGetValidSession,
        signout: mockSignout,
      });

      const originalRequest = { headers: {}, _retry: false };
      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      // responseErrorHandler calls api(originalRequest) which is our mockAxiosInstance
      await responseErrorHandler(error);

      expect(originalRequest._retry).toBe(true);
      expect(mockGetValidSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(originalRequest.headers).toHaveProperty('Authorization', `Bearer ${mockToken}`);
      expect(mockAxiosInstance).toHaveBeenCalledWith(originalRequest);
    });

    it('logs out and throws if refresh session fails to return a session', async () => {
      const mockSignout = jest.fn();

      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockResolvedValue(null), // No session after refresh
        signout: mockSignout,
      });

      const error = { response: { status: 401 }, config: {} };
      try {
        await responseErrorHandler(error);
        throw new Error('Expected response interceptor to reject');
      } catch (caughtError) {
        expect(isAuthRedirectError(caughtError)).toBe(true);
      }
      expect(mockSignout).toHaveBeenCalled();
    });

    it('logs out and throws if getValidSession throws error', async () => {
      const mockSignout = jest.fn();

      mockGetState.mockReturnValue({
        getValidSession: jest.fn().mockRejectedValue(new Error('Refresh Fail')),
        signout: mockSignout,
      });

      const error = { response: { status: 401 }, config: {} };
      try {
        await responseErrorHandler(error);
        throw new Error('Expected response interceptor to reject');
      } catch (caughtError) {
        expect(isAuthRedirectError(caughtError)).toBe(true);
      }
      expect(mockSignout).toHaveBeenCalled();
    });
  });
});
