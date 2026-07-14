import { isAppointmentRevampEnabled, isCompanionRevampEnabled } from '@/app/lib/featureFlags';

describe('featureFlags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isAppointmentRevampEnabled', () => {
    it('returns true when the env var is "true"', () => {
      process.env.NEXT_PUBLIC_APPOINTMENT_REVAMP = 'true';
      expect(isAppointmentRevampEnabled()).toBe(true);
    });

    it('returns false when the env var is unset', () => {
      delete process.env.NEXT_PUBLIC_APPOINTMENT_REVAMP;
      expect(isAppointmentRevampEnabled()).toBe(false);
    });

    it('returns false when the env var is any other value', () => {
      process.env.NEXT_PUBLIC_APPOINTMENT_REVAMP = 'false';
      expect(isAppointmentRevampEnabled()).toBe(false);
    });
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
