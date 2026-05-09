import axios from 'axios';
import {
  fetchMobileConfig,
  isDevelopmentMobileEnv,
  isProductionMobileEnv,
  MobileConfig,
} from '../../../src/shared/services/mobileConfig';
import {
  DEVELOPMENT_API_BASE_URL,
  ENVIRONMENT_CONFIG,
  MOBILE_CONFIG_BEHAVIOR,
  MOBILE_CONFIG_PATH,
  PRODUCTION_API_BASE_URL,
} from '../../../src/config/variables';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const expectedMobileConfigUrl = (): string => {
  if (MOBILE_CONFIG_BEHAVIOR.overrides?.mobileConfigUrl) {
    return MOBILE_CONFIG_BEHAVIOR.overrides.mobileConfigUrl;
  }

  const baseUrl =
    ENVIRONMENT_CONFIG.appEnv === 'production'
      ? PRODUCTION_API_BASE_URL
      : DEVELOPMENT_API_BASE_URL;

  return `${baseUrl}${MOBILE_CONFIG_PATH}`;
};

describe('mobileConfig Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. isProductionMobileEnv Tests
  // =========================================================================
  describe('isProductionMobileEnv', () => {
    it('returns true for "prod"', () => {
      expect(isProductionMobileEnv('prod')).toBe(true);
    });

    it('returns true for "production"', () => {
      expect(isProductionMobileEnv('production')).toBe(true);
    });

    it('returns true for case-insensitive inputs ("PROD")', () => {
      // The function uses String(env).toLowerCase()
      expect(isProductionMobileEnv('PROD' as any)).toBe(true);
    });

    it('returns false for "dev" or "development"', () => {
      expect(isProductionMobileEnv('dev')).toBe(false);
      expect(isProductionMobileEnv('development')).toBe(false);
    });

    it('returns false for "staging"', () => {
      expect(isProductionMobileEnv('staging')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isProductionMobileEnv(null)).toBe(false);
      expect(isProductionMobileEnv(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      // @ts-ignore - testing runtime behavior for empty string
      expect(isProductionMobileEnv('')).toBe(false);
    });
  });

  // =========================================================================
  // 2. isDevelopmentMobileEnv Tests
  // =========================================================================
  describe('isDevelopmentMobileEnv', () => {
    it('returns true for "dev"', () => {
      expect(isDevelopmentMobileEnv('dev')).toBe(true);
    });

    it('returns true for "development"', () => {
      expect(isDevelopmentMobileEnv('development')).toBe(true);
    });

    it('returns true for case-insensitive inputs ("DEV")', () => {
      expect(isDevelopmentMobileEnv('DEV' as any)).toBe(true);
    });

    it('returns false for "prod" or "production"', () => {
      expect(isDevelopmentMobileEnv('prod')).toBe(false);
      expect(isDevelopmentMobileEnv('production')).toBe(false);
    });

    it('returns false for "staging"', () => {
      expect(isDevelopmentMobileEnv('staging')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isDevelopmentMobileEnv(null)).toBe(false);
      expect(isDevelopmentMobileEnv(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      // @ts-ignore
      expect(isDevelopmentMobileEnv('')).toBe(false);
    });
  });

  // =========================================================================
  // 3. fetchMobileConfig Tests
  // =========================================================================
  describe('fetchMobileConfig', () => {
    const mockConfig: MobileConfig = {
      env: 'dev',
      enablePayments: true,
      stripePublishableKey: 'pk_test_123',
      sentryDsn: 'https://sentry.io/123',
      forceLiquidGlassBorder: false,
    };

    it('fetches mobile config successfully', async () => {
      // Setup mock response
      mockedAxios.get.mockResolvedValueOnce({data: mockConfig});

      const result = await fetchMobileConfig();

      // Verify axios call
      expect(mockedAxios.get).toHaveBeenCalledWith(expectedMobileConfigUrl(), {
        timeout: 8000,
      });
      // Verify result
      expect(result).toEqual(mockConfig);
    });

    it('propagates errors when axios fails', async () => {
      const error = new Error('Network Error');
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(fetchMobileConfig()).rejects.toThrow('Network Error');
    });

    it('uses a request timeout so startup does not hang on splash indefinitely', async () => {
      mockedAxios.get.mockResolvedValueOnce({data: mockConfig});

      await fetchMobileConfig();

      expect(mockedAxios.get).toHaveBeenCalledWith(expectedMobileConfigUrl(), {
        timeout: 8000,
      });
    });
  });
});
