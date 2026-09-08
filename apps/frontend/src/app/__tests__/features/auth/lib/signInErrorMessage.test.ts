import {
  DEFAULT_SIGN_IN_ERROR,
  signInErrorMessage,
  statusOf,
} from '@/app/features/auth/lib/signInErrorMessage';

describe('signInErrorMessage', () => {
  it('explains a rate-limited bootstrap without blaming the credentials', () => {
    // The observed failure: /auth/signin returned 200 and /v1/auth/me returned 429.
    const message = signInErrorMessage({ response: { status: 429 } });
    expect(message).toMatch(/too many requests/i);
    expect(message).toMatch(/wait a minute/i);
    // The credentials were accepted, so the copy must not suggest otherwise.
    expect(message).not.toMatch(/password|incorrect|invalid/i);
    expect(message).not.toMatch(/status code/i);
  });

  it('never shows a raw transport string, whatever the status', () => {
    expect(signInErrorMessage({ message: 'Request failed with status code 500' })).toBe(
      DEFAULT_SIGN_IN_ERROR
    );
    expect(signInErrorMessage({ message: 'Request failed with status code 429' })).toBe(
      DEFAULT_SIGN_IN_ERROR
    );
  });

  it('keeps a message the API wrote for a person', () => {
    expect(signInErrorMessage({ message: 'Incorrect email or password.' })).toBe(
      'Incorrect email or password.'
    );
  });

  it('handles an upstream outage separately from throttling', () => {
    for (const status of [502, 503, 504]) {
      expect(signInErrorMessage({ response: { status } })).toMatch(/temporarily unavailable/i);
    }
  });

  it('falls back rather than rendering nothing', () => {
    expect(signInErrorMessage(undefined)).toBe(DEFAULT_SIGN_IN_ERROR);
    expect(signInErrorMessage(null)).toBe(DEFAULT_SIGN_IN_ERROR);
    expect(signInErrorMessage({})).toBe(DEFAULT_SIGN_IN_ERROR);
    expect(signInErrorMessage({ message: '   ' })).toBe(DEFAULT_SIGN_IN_ERROR);
  });

  it('reads the status from either shape the transport throws', () => {
    expect(statusOf({ response: { status: 429 } })).toBe(429);
    expect(statusOf({ status: 503 })).toBe(503);
    expect(statusOf({ status: '429' })).toBeUndefined();
    expect(statusOf(undefined)).toBeUndefined();
  });
});
