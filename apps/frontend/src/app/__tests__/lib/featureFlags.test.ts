import { isCompanionRevampEnabled, isStreamChatConfigured } from '@/app/lib/featureFlags';

describe('featureFlags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isCompanionRevampEnabled', () => {
    it('returns true when the env var is "true"', () => {
      process.env.NEXT_PUBLIC_COMPANION_REVAMP = 'true';
      expect(isCompanionRevampEnabled()).toBe(true);
    });

    it('returns false when the env var is unset', () => {
      delete process.env.NEXT_PUBLIC_COMPANION_REVAMP;
      expect(isCompanionRevampEnabled()).toBe(false);
    });
  });

  describe('isStreamChatConfigured', () => {
    it('returns true when a Stream API key is set', () => {
      process.env.NEXT_PUBLIC_STREAM_API_KEY = 'stream-key';
      expect(isStreamChatConfigured()).toBe(true);
    });

    it('returns false when the key is unset or empty', () => {
      delete process.env.NEXT_PUBLIC_STREAM_API_KEY;
      expect(isStreamChatConfigured()).toBe(false);
      // .env.example ships the key as an empty string.
      process.env.NEXT_PUBLIC_STREAM_API_KEY = '';
      expect(isStreamChatConfigured()).toBe(false);
    });
  });
});
