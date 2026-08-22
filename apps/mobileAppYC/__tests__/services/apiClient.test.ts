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

    it('rewrites localhost without explicit port to 10.0.2.2 (port-less path)', () => {
      const {axiosMock} = loadClientWithEnv('android', {
        baseUrl: 'http://localhost/api',
      });

      expect(axiosMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://10.0.2.2/api',
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

  describe('updateApiClientBaseConfig', () => {
    it('updates baseURL when baseUrl is provided', () => {
      const {axiosMock} = loadClientWithEnv('ios');
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: '', timeout: 5000};

      updateApiClientBaseConfig({baseUrl: 'https://new-api.example.com'});

      expect(mockInstance.defaults.baseURL).toBe('https://new-api.example.com');
    });

    it('updates timeout when timeoutMs is provided', () => {
      const {axiosMock} = loadClientWithEnv('ios');
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: '', timeout: 5000};

      updateApiClientBaseConfig({timeoutMs: 10000});

      expect(mockInstance.defaults.timeout).toBe(10000);
    });

    it('normalizes localhost baseUrl to 10.0.2.2 on Android', () => {
      const {axiosMock} = loadClientWithEnv('android');
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: '', timeout: 5000};

      updateApiClientBaseConfig({baseUrl: 'http://localhost:8080/api'});

      expect(mockInstance.defaults.baseURL).toBe('http://10.0.2.2:8080/api');
    });

    it('ignores update when neither baseUrl nor timeoutMs given', () => {
      const {axiosMock} = loadClientWithEnv('ios');
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: 'https://original.com', timeout: 5000};

      updateApiClientBaseConfig({});

      expect(mockInstance.defaults.baseURL).toBe('https://original.com');
      expect(mockInstance.defaults.timeout).toBe(5000);
    });

    it('ignores timeoutMs when value is not a number', () => {
      const {axiosMock} = loadClientWithEnv('ios');
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: '', timeout: 5000};

      updateApiClientBaseConfig({
        timeoutMs: 'not-a-number' as unknown as number,
      });

      expect(mockInstance.defaults.timeout).toBe(5000);
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
          hasBody: false,
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
        hasBody: true,
      });
      expect(result).toBe(mockResponse);
    });

    it('Response Interceptor (Success): never logs the response body', () => {
      const {responseSuccessInterceptor} = getInterceptorCallbacks();

      const mockResponse = {
        status: 200,
        data: {
          clientSecret: 'dummy-client-secret-value',
          email: 'parent@example.com',
        },
        config: {method: 'get', url: '/payment-intent'},
      };

      responseSuccessInterceptor(mockResponse);

      const logged = JSON.stringify(consoleLogSpy.mock.calls);
      expect(logged).not.toContain('dummy-client-secret-value');
      expect(logged).not.toContain('parent@example.com');
    });

    it('Response Interceptor (Error): never logs the error response body', async () => {
      const {responseErrorInterceptor} = getInterceptorCallbacks();

      const mockError = {
        response: {
          status: 400,
          data: {email: 'parent@example.com', token: 'secret-token'},
        },
        config: {method: 'post', url: '/submit'},
        message: 'Request failed',
      };

      if (!responseErrorInterceptor) {
        throw new Error('Response error interceptor not found');
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);

      const logged = JSON.stringify(consoleLogSpy.mock.calls);
      expect(logged).not.toContain('parent@example.com');
      expect(logged).not.toContain('secret-token');
    });

    it('Response Interceptor (Success): reports hasBody false for an empty body', () => {
      const {responseSuccessInterceptor} = getInterceptorCallbacks();

      responseSuccessInterceptor({
        status: 204,
        data: null,
        config: {method: 'delete', url: '/thing'},
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[API] Response',
        expect.objectContaining({hasBody: false}),
      );
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
        message: 'Request failed',
        hasBody: true,
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
        method: 'get',
        url: '',
        message: 'Network Error',
      });
    });

    it('Response Interceptor (Success): falls back to an empty config when none is provided', () => {
      const {responseSuccessInterceptor} = getInterceptorCallbacks();

      const mockResponse = {
        status: 200,
        data: {id: 1},
        config: undefined,
      };

      const result = responseSuccessInterceptor(mockResponse);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Response', {
        method: undefined,
        url: '',
        status: 200,
        hasBody: true,
      });
      expect(result).toBe(mockResponse);
    });

    it('Response Interceptor (Error): falls back to an empty config for server errors', async () => {
      const {responseErrorInterceptor} = getInterceptorCallbacks();

      const mockError = {
        response: {status: 500, data: {error: 'Server Error'}},
        config: undefined,
        message: 'Request failed',
      };

      if (!responseErrorInterceptor) {
        throw new Error('Response error interceptor not found');
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Error Response', {
        method: undefined,
        url: '',
        status: 500,
        message: 'Request failed',
        hasBody: true,
      });
    });

    it('Response Interceptor (Error): falls back to an empty config for network errors', async () => {
      const {responseErrorInterceptor} = getInterceptorCallbacks();

      const mockError = {
        config: undefined,
        message: 'Network Error',
      };

      if (!responseErrorInterceptor) {
        throw new Error('Response error interceptor not found');
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toBe(mockError);

      expect(consoleLogSpy).toHaveBeenCalledWith('[API] Error', {
        method: undefined,
        url: '',
        message: 'Network Error',
      });
    });
  });

  describe('shouldLogNetworkActivity = false', () => {
    let originalDev: boolean;

    beforeEach(() => {
      originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;
    });

    afterEach(() => {
      (global as any).__DEV__ = originalDev;
    });

    it('skips all console logging when network activity logging is disabled', async () => {
      const {axiosMock} = loadClientWithEnv('ios');

      const requestInterceptor = mockRequestUse.mock.calls[0][0];
      const responseSuccessInterceptor = mockResponseUse.mock.calls[0][0];
      const responseErrorInterceptor = mockResponseUse.mock.calls[0][1];
      const {
        updateApiClientBaseConfig,
      } = require('../../src/shared/services/apiClient');
      const mockInstance =
        axiosMock.create.mock.results[0]?.value ?? axiosMock.create();
      mockInstance.defaults = {baseURL: '', timeout: 5000};

      requestInterceptor({method: 'get', url: '/x'});
      responseSuccessInterceptor({status: 200, config: {method: 'get'}});
      await expect(
        responseErrorInterceptor({message: 'err', config: {}}),
      ).rejects.toBeDefined();
      updateApiClientBaseConfig({baseUrl: 'https://example.com'});

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('__DEV__ is undefined', () => {
    let originalDev: boolean;

    beforeEach(() => {
      originalDev = (global as any).__DEV__;
      delete (global as any).__DEV__;
    });

    afterEach(() => {
      (global as any).__DEV__ = originalDev;
    });

    it('does not log when __DEV__ is not defined', () => {
      loadClientWithEnv('ios');

      const requestInterceptor = mockRequestUse.mock.calls[0][0];
      const responseSuccessInterceptor = mockResponseUse.mock.calls[0][0];

      requestInterceptor({method: 'get', url: '/x'});
      responseSuccessInterceptor({
        status: 200,
        data: {id: 1},
        config: {method: 'get'},
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});

describe('error redaction', () => {
  it('removes the bearer token from a rejected request config', async () => {
    // Axios keeps the request config on the error, and many screens log the raw
    // error - which would write the access token into the device log.
    const error: {
      config: {headers: Record<string, unknown>};
      response?: unknown;
      message: string;
    } = {
      config: {
        headers: {
          Authorization: 'Bearer super-secret-token',
          Accept: 'application/json',
        },
      },
      message: 'Request failed',
    };

    const {
      redactAuthorizationHeader,
    } = require('../../src/shared/services/apiClient');

    redactAuthorizationHeader(error);

    expect(error.config.headers.Authorization).toBe('[REDACTED]');
    expect(error.config.headers.Accept).toBe('application/json');
  });
});
