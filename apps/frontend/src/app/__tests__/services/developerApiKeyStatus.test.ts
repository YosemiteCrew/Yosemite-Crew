import {
  apiKeyDisplayStatus,
  isApiKeyUsable,
  isKeyLimitReached,
  MAX_ACTIVE_API_KEYS,
} from '@/app/services/developerApiKeyStatus';

describe('apiKeyDisplayStatus', () => {
  const NOW = Date.parse('2026-09-21T12:00:00.000Z');
  const key = (over: Partial<{ status: 'active' | 'revoked'; expiresAt: string | null }>) => ({
    status: 'active' as const,
    expiresAt: null as string | null,
    ...over,
  });

  it('leaves a key with no expiry active', () => {
    expect(apiKeyDisplayStatus(key({}), NOW)).toBe('active');
  });

  it('is active one millisecond before the expiry instant', () => {
    expect(apiKeyDisplayStatus(key({ expiresAt: new Date(NOW + 1).toISOString() }), NOW)).toBe(
      'active'
    );
  });

  /* The boundary the API uses: verify() refuses the key when
     `expiresAt <= now`, so equality is already too late, not still valid. */
  it('is expired exactly at the expiry instant', () => {
    expect(apiKeyDisplayStatus(key({ expiresAt: new Date(NOW).toISOString() }), NOW)).toBe(
      'expired'
    );
  });

  it('is expired after the expiry instant', () => {
    expect(apiKeyDisplayStatus(key({ expiresAt: new Date(NOW - 1).toISOString() }), NOW)).toBe(
      'expired'
    );
  });

  /* Revoked outranks expired: the owner acted, and saying "expired" would hide
     that the record was deliberately withdrawn. */
  it('keeps a revoked key revoked even once its expiry has passed', () => {
    expect(
      apiKeyDisplayStatus(
        key({ status: 'revoked', expiresAt: new Date(NOW - 1).toISOString() }),
        NOW
      )
    ).toBe('revoked');
  });

  /* An unreadable timestamp is not evidence of expiry. The API decides access;
     inventing an expiry here would hide a working key from its owner. */
  it('leaves a key active when its expiry does not parse', () => {
    expect(apiKeyDisplayStatus(key({ expiresAt: 'not-a-date' }), NOW)).toBe('active');
  });

  it('defaults to the current clock when no time is given', () => {
    expect(apiKeyDisplayStatus(key({ expiresAt: '2000-01-01T00:00:00.000Z' }))).toBe('expired');
  });
});

describe('isApiKeyUsable', () => {
  const NOW = Date.parse('2026-09-21T12:00:00.000Z');

  it.each([
    ['unexpired active', { status: 'active' as const, expiresAt: null }, true],
    ['expired active', { status: 'active' as const, expiresAt: '2026-09-20T00:00:00.000Z' }, false],
    ['revoked', { status: 'revoked' as const, expiresAt: null }, false],
  ])('treats an %s key as usable=%s', (_label, key, expected) => {
    expect(isApiKeyUsable(key, NOW)).toBe(expected);
  });
});

describe('isKeyLimitReached', () => {
  it('recognises the ceiling response', () => {
    expect(isKeyLimitReached({ response: { status: 429 } })).toBe(true);
  });

  it('does not claim the ceiling for any other failure', () => {
    expect(isKeyLimitReached({ response: { status: 500 } })).toBe(false);
    expect(isKeyLimitReached(new Error('network'))).toBe(false);
    expect(isKeyLimitReached(undefined)).toBe(false);
  });
});

describe('MAX_ACTIVE_API_KEYS', () => {
  /* Pinned deliberately. The backend refuses a further key at
     MAX_ACTIVE_KEYS_PER_OWNER in developer-api-key.service.ts, and nothing in
     the build compares the two: this test is where a one-sided change to either
     number is meant to be noticed. */
  it('matches the ceiling the API enforces', () => {
    expect(MAX_ACTIVE_API_KEYS).toBe(25);
  });
});
