import axios from 'axios';
import {
  fetchMobileConfig,
  isDevelopmentMobileEnv,
  isProductionMobileEnv,
  MobileConfig,
} from '../../../src/shared/services/mobileConfig';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
      mockedAxios.get.mockResolvedValueOnce({ data: mockConfig });

      const result = await fetchMobileConfig();

      // Verify axios call
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.yosemitecrew.com/v1/mobile-config/'
      );
      // Verify result
      expect(result).toEqual(mockConfig);
    });

    it('propagates errors when axios fails', async () => {
      const error = new Error('Network Error');
      mockedAxios.get.mockRejectedValueOnce(error);

      await expect(fetchMobileConfig()).rejects.toThrow('Network Error');
    });
  });
});