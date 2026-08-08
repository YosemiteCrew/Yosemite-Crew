import { isCompanionRevampEnabled } from '@/app/lib/featureFlags';

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
});
