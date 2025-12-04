import {API_CONFIG} from '../../src/config/variables';

// --- Global Mocks (defaults) ---
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
}));

const mockRequestUse = jest.fn(config => config);
// Fix: Explicitly define both arguments so TS knows the calls array has 2 elements
const mockResponseUse = jest.fn(
  (onFulfilled, onRejected) => onFulfilled || onRejected,
);

jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: {use: mockRequestUse},
        response: {use: mockResponseUse},
      },
    })),
  };
});

// Fix: Use relative path to resolve module not found error
jest.mock('../../src/config/variables', () => ({
  API_CONFIG: {
    baseUrl: 'http://localhost:3000',
    timeoutMs: 5000,
  },
}));

describe('apiClient', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.resetModules(); // CRITICAL: Clear cache so doMock works
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  // Helper to load the client with specific environment mocks
  const loadClientWithEnv = (
    platformOS: string,
    configOverrides: Partial<typeof API_CONFIG> = {},
  ) => {
    // 1. Override Platform
    jest.doMock('react-native', () => ({
      Platform: {OS: platformOS},
    }));

    // 2. Override Config using relative path
    jest.doMock('../../src/config/variables', () => ({
      API_CONFIG: {
        baseUrl: 'http://localhost:3000',
        timeoutMs: 5000,
        ...configOverrides,
      },
    }));

    // 3. Re-require modules
    const client = require('../../src/shared/services/apiClient').default;
    const axiosMock = require('axios');

    return {client, axiosMock};
  };

  describe('normalizeBaseUrl Logic (via axios.create)', () => {
    it('passes URL unchanged on iOS', () => {
      const {axiosMock} = loadClientWithEnv('ios', {
        baseUrl: 'http://localhost:3000',
      });

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:3000',
        }),
      );
    });

    it('returns raw url if empty/undefined', () => {
      const {axiosMock} = loadClientWithEnv('android', {baseUrl: ''});

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: '',
        }),
      );
    });

    it('rewrites localhost to 10.0.2.2 on Android', () => {
      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'http://localhost:3000/api',
      });

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://10.0.2.2:3000/api',
        }),
      );
    });

    it('rewrites 127.0.0.1 to 10.0.2.2 on Android', () => {
      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'http://127.0.0.1:8080',
      });

      // Expect trailing slash due to URL normalization
      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://10.0.2.2:8080/',
        }),
      );
    });

    it('rewrites 0.0.0.0 to 10.0.2.2 on Android', () => {
      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'http://0.0.0.0:4000',
      });

      // Expect trailing slash due to URL normalization
      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://10.0.2.2:4000/',
        }),
      );
    });

    it('keeps remote URLs unchanged on Android', () => {
      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'https://api.yosemite.com',
      });

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.yosemite.com',
        }),
      );
    });

    it('handles URL parsing errors via string replacement fallback', () => {
      // Fix: Use globalThis instead of global
      const originalURL = globalThis.URL;
      // Force URL constructor to throw to hit catch block
      // @ts-ignore
      globalThis.URL = jest.fn(() => {
        throw new Error('Parse error');
      });

      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'http://localhost:3000/fallback',
      });

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://10.0.2.2:3000/fallback',
        }),
      );

      globalThis.URL = originalURL;
    });
  });

  describe('withAuthHeaders', () => {
    it('returns default headers with token', () => {
      loadClientWithEnv('ios');
      const {withAuthHeaders} = require('../../src/shared/services/apiClient');
      const headers = withAuthHeaders('xyz-token');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer xyz-token',
      });
    });

    it('merges extra headers correctly', () => {
      loadClientWithEnv('ios');
      const {withAuthHeaders} = require('../../src/shared/services/apiClient');
      const headers = withAuthHeaders('xyz-token', {'X-Custom': 'abc'});
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer xyz-token',
        'X-Custom': 'abc',
      });
    });
  });

  describe('Interceptors', () => {
    const getInterceptorCallbacks = () => {
      loadClientWithEnv('ios');

      // mockRequestUse.mock.calls[0] -> [requestCallback]
      const requestInterceptor = mockRequestUse.mock.calls[0][0];

      // mockResponseUse.mock.calls[0] -> [successCallback, errorCallback]
      const responseSuccessInterceptor = mockResponseUse.mock.calls[0][0];
      const responseErrorInterceptor = mockResponseUse.mock.calls[0][1];

      return {
        requestInterceptor,
        responseSuccessInterceptor,
        responseErrorInterceptor,
      };
    };

    it('Request Interceptor: logs request with combined URL', () => {
      const {requestInterceptor} = getInterceptorCallbacks();

      const mockConfig = {
        method: 'get',
        baseURL: 'https://api.com/',
        url: '/users',
        headers: {Auth: '123'},
        data: null,
        timeout: 1000,
      };

      const result = requestInterceptor(mockConfig);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API] Request',
        expect.objectContaining({
          url: 'https://api.com/users',
          method: 'get',
        }),
      );
      expect(result).toBe(mockConfig);
    });

    it('Request Interceptor: handles missing baseURL', () => {
      const {requestInterceptor} = getInterceptorCallbacks();

      const mockConfig = {
        method: 'post',
        url: 'https://full-url.com/path',
      };

      const result = requestInterceptor(mockConfig);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API] Request',
        expect.objectContaining({
          url: 'https://full-url.com/path',
        }),
      );
      expect(result).toBe(mockConfig);
    });

    it('Response Interceptor (Success): logs and returns response', () => {
      const {responseSuccessInterceptor} = getInterceptorCallbacks();

      const mockResponse = {
        status: 200,
        data: {id: 1},
        config: {method: 'get', url: '/test'},
      };

      const result = responseSuccessInterceptor(mockResponse);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Response', {
        method: 'get',
        url: '/test',
        status: 200,
        data: {id: 1},
      });
      expect(result).toBe(mockResponse);
    });

    it('Response Interceptor (Error): handles server response errors', async () => {
      const {responseErrorInterceptor} = getInterceptorCallbacks();

      const mockError = {
        response: {
          status: 400,
          data: {error: 'Bad Request'},
        },
        config: {method: 'post', url: '/submit'},
        message: 'Request failed',
      };

      // Fix: Add '!' assertion or guard because TS thinks it might be undefined
      if (!responseErrorInterceptor) {
        throw new Error('Response error interceptor not found');
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Error Response', {
        method: 'post',
        url: '/submit',
        status: 400,
        data: {error: 'Bad Request'},
      });
    });

    it('Response Interceptor (Error): handles network/no-response errors', async () => {
      const {responseErrorInterceptor} = getInterceptorCallbacks();

      const mockError = {
        // No response property
        config: {method: 'get'},
        message: 'Network Error',
      };

      // Fix: Add '!' assertion or guard
      if (!responseErrorInterceptor) {
        throw new Error('Response error interceptor not found');
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Error', {
        message: 'Network Error',
        config: {method: 'get'},
      });
    });
  });
});