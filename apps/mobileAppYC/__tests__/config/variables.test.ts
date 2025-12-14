describe('Configuration Variables', () => {
  const originalEnv = process.env;
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.resetModules();
    process.env = {...originalEnv};
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  // ===========================================================================
  // 1. Default Behavior (No local file)
  // ===========================================================================

  describe('Default Configuration (Missing variables.local.ts)', () => {
    beforeEach(() => {
      // Mock the require to throw MODULE_NOT_FOUND
      jest.mock(
        '../../src/config/variables.local',
        () => {
          const error: any = new Error(
            "Cannot find module './variables.local'",
          );
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        },
        {virtual: true},
      );
    });

    it('uses default values when local config is missing', () => {
      // Re-import to trigger the try-catch block
      const config = require('../../src/config/variables');

      expect(config.API_CONFIG.baseUrl).toBe('https://devapi.yosemitecrew.com');
      expect(config.PASSWORDLESS_AUTH_CONFIG.profileServiceUrl).toBe('');
      expect(config.STREAM_CHAT_CONFIG.apiKey).toBe('');
      expect(config.STRIPE_CONFIG.urlScheme).toBe('yosemitecrew');
      expect(config.AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(true);
      expect(config.DEMO_LOGIN_CONFIG.email).toBe('');
    });

    it('exports storage keys correctly', () => {
      // These are static exports, just verifying integrity
      const config = require('../../src/config/variables');
      expect(config.PENDING_PROFILE_STORAGE_KEY).toBe(
        '@pending_profile_payload',
      );
      expect(config.PENDING_PROFILE_UPDATED_EVENT).toBe(
        'pendingProfileUpdated',
      );
    });

    it('suppresses console warning in test environment', () => {
      process.env.NODE_ENV = 'test';
      require('../../src/config/variables');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('logs warning if not in test/CI environment and file is missing', () => {
      process.env.NODE_ENV = 'development';
      process.env.CI = 'false';

      require('../../src/config/variables');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No variables.local.ts found'),
      );
    });
  });

  // ===========================================================================
  // 2. Override Behavior (Local file exists)
  // ===========================================================================

  describe('Local Configuration Override', () => {
    const mockLocalConfig = {
      PASSWORDLESS_AUTH_CONFIG: {profileServiceUrl: 'http://override.com'},
      GOOGLE_PLACES_CONFIG: {apiKey: 'OVERRIDE_GOOGLE_KEY'},
      API_CONFIG: {baseUrl: 'http://localhost:3000'},
      STREAM_CHAT_CONFIG: {apiKey: 'OVERRIDE_STREAM_KEY'},
      STRIPE_CONFIG: {publishableKey: 'pk_test_override'},
      AUTH_FEATURE_FLAGS: {enableReviewLogin: false},
      DEMO_LOGIN_CONFIG: {email: 'test@example.com'},
    };

    beforeEach(() => {
      // Mock successful load of local config
      jest.mock('../../src/config/variables.local', () => mockLocalConfig, {
        virtual: true,
      });
    });

    it('merges local overrides with defaults', () => {
      const config = require('../../src/config/variables');

      // Check overridden values
      expect(config.PASSWORDLESS_AUTH_CONFIG.profileServiceUrl).toBe(
        'http://override.com',
      );
      expect(config.GOOGLE_PLACES_CONFIG.apiKey).toBe('OVERRIDE_GOOGLE_KEY');
      expect(config.API_CONFIG.baseUrl).toBe('http://localhost:3000');
      expect(config.STREAM_CHAT_CONFIG.apiKey).toBe('OVERRIDE_STREAM_KEY');
      expect(config.STRIPE_CONFIG.publishableKey).toBe('pk_test_override');
      expect(config.AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(false);
      expect(config.DEMO_LOGIN_CONFIG.email).toBe('test@example.com');

      // Check that non-overridden defaults persist (e.g. timeoutMs inside API_CONFIG)
      expect(config.API_CONFIG.timeoutMs).toBe(15000);
    });
  });

  // ===========================================================================
  // 3. Error Handling (Unexpected Errors)
  // ===========================================================================

  describe('Error Handling', () => {
    it('re-throws unknown errors during require', () => {
      // Mock an error that is NOT 'MODULE_NOT_FOUND' (e.g. syntax error in local file)
      jest.mock(
        '../../src/config/variables.local',
        () => {
          throw new Error('SyntaxError: Unexpected token');
        },
        {virtual: true},
      );

      expect(() => {
        require('../../src/config/variables');
      }).toThrow('SyntaxError: Unexpected token');
    });

    it('handles non-object errors gracefully', () => {
      // Edge case for isMissingLocalVariablesModule helper logic
      // If require throws a string or null (unlikely but typescript guarded)
      jest.mock(
        '../../src/config/variables.local',
        () => {
          throw 'Critical Failure';
        },
        {virtual: true},
      );

      expect(() => {
        require('../../src/config/variables');
      }).toThrow('Critical Failure');
    });
  });
});