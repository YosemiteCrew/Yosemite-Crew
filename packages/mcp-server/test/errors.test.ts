import {
  FREE_TIER_MONTHLY_LIMIT,
  YcApiError,
  describeToolError,
  isAxiosErrorLike,
  toYcApiError,
} from '../src/errors.js';
import { axiosError, networkError } from './helpers.js';

describe('isAxiosErrorLike', () => {
  it('recognises axios-shaped errors', () => {
    expect(isAxiosErrorLike(axiosError(500, {}))).toBe(true);
    expect(isAxiosErrorLike(networkError())).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAxiosErrorLike(null)).toBe(false);
    expect(isAxiosErrorLike(undefined)).toBe(false);
    expect(isAxiosErrorLike(new Error('boom'))).toBe(false);
    expect(isAxiosErrorLike({ isAxiosError: false })).toBe(false);
    expect(isAxiosErrorLike('string')).toBe(false);
  });
});

describe('toYcApiError', () => {
  it('returns an existing YcApiError untouched', () => {
    const original = new YcApiError('already typed', { status: 404, code: 'not_found' });
    expect(toYcApiError(original)).toBe(original);
  });

  it('maps a response error onto status, code, and message from the envelope', () => {
    const err = toYcApiError(
      axiosError(403, {
        message: 'Insufficient scope for this API key',
        code: 'insufficient_scope',
      })
    );
    expect(err).toBeInstanceOf(YcApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('insufficient_scope');
    expect(err.message).toBe('Insufficient scope for this API key');
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('falls back to a generic message when the envelope is absent', () => {
    const err = toYcApiError(axiosError(500, 'not json'));
    expect(err.status).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.message).toBe('Request failed with status 500');
  });

  it('ignores non-string message and code values in the envelope', () => {
    const err = toYcApiError(axiosError(400, { message: 42, code: { nested: true } }));
    expect(err.message).toBe('Request failed with status 400');
    expect(err.code).toBeUndefined();
  });

  it('parses a string Retry-After header', () => {
    const err = toYcApiError(
      axiosError(429, { message: 'quota', code: 'quota_exceeded' }, { 'retry-after': '2073600' })
    );
    expect(err.retryAfterSeconds).toBe(2073600);
  });

  it('accepts a numeric Retry-After header', () => {
    const err = toYcApiError(
      axiosError(429, { message: 'slow down', code: 'rate_limited' }, { 'retry-after': 1 })
    );
    expect(err.retryAfterSeconds).toBe(1);
  });

  it('drops an unparseable Retry-After header', () => {
    const err = toYcApiError(
      axiosError(429, { message: 'slow down', code: 'rate_limited' }, { 'retry-after': 'soon' })
    );
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('describes network failures without a status', () => {
    const err = toYcApiError(networkError('connect ECONNREFUSED 127.0.0.1:3000'));
    expect(err.status).toBeUndefined();
    expect(err.message).toContain('Could not reach the Yosemite Crew API');
    expect(err.message).toContain('YC_API_BASE_URL');
  });

  it('wraps plain Error instances', () => {
    const err = toYcApiError(new Error('unexpected'));
    expect(err.message).toBe('unexpected');
    expect(err.status).toBeUndefined();
  });

  it('stringifies non-error values', () => {
    expect(toYcApiError('boom').message).toBe('boom');
  });
});

describe('describeToolError', () => {
  it('explains 400 responses and points at cursor misuse', () => {
    const text = describeToolError(
      axiosError(400, { message: 'Invalid cursor', code: 'invalid_request' })
    );
    expect(text).toContain('invalid_request');
    expect(text).toContain('Invalid cursor');
    expect(text).toContain('pagination.nextCursor');
  });

  it('tells the user to check YC_API_KEY on 401', () => {
    const text = describeToolError(
      axiosError(401, { message: 'Invalid or expired API key', code: 'invalid_api_key' })
    );
    expect(text).toContain('YC_API_KEY');
    expect(text).toContain('invalid_api_key');
    expect(text).toContain('revoked');
  });

  it('names the missing scope on 403 when the tool provides one', () => {
    const text = describeToolError(
      axiosError(403, {
        message: 'Insufficient scope for this API key',
        code: 'insufficient_scope',
      }),
      'appointments:read'
    );
    expect(text).toContain("'appointments:read'");
    expect(text).toContain('insufficient_scope');
  });

  it('still explains 403 without a scope hint', () => {
    const text = describeToolError(
      axiosError(403, {
        message: 'Insufficient scope for this API key',
        code: 'insufficient_scope',
      })
    );
    expect(text).toContain('Permission denied');
    expect(text).not.toContain("' scope");
  });

  it('explains the org-scoping behaviour on 404', () => {
    const text = describeToolError(axiosError(404, { message: 'Not found', code: 'not_found' }));
    expect(text).toContain('does not exist or belongs to a different organisation');
  });

  it('explains the free tier on quota_exceeded with a reset hint', () => {
    const text = describeToolError(
      axiosError(
        429,
        {
          message: 'Monthly API quota exceeded. Upgrade to Pro to continue.',
          code: 'quota_exceeded',
        },
        { 'retry-after': '2073600' }
      )
    );
    expect(text).toContain(String(FREE_TIER_MONTHLY_LIMIT));
    expect(text).toContain('free tier');
    expect(text).toContain('2073600');
    expect(text).toContain('get_usage');
  });

  it('falls back to the UTC month reset when quota_exceeded has no Retry-After', () => {
    const text = describeToolError(
      axiosError(429, { message: 'Monthly API quota exceeded.', code: 'quota_exceeded' })
    );
    expect(text).toContain('next UTC month');
  });

  it('reports the retry window on rate_limited', () => {
    const text = describeToolError(
      axiosError(
        429,
        { message: 'Rate limit exceeded for this API key.', code: 'rate_limited' },
        {
          'retry-after': '1',
        }
      )
    );
    expect(text).toContain('Retry in 1 second(s)');
  });

  it('defaults the rate_limited retry window to 1 second', () => {
    const text = describeToolError(
      axiosError(429, { message: 'Rate limit exceeded for this API key.', code: 'rate_limited' })
    );
    expect(text).toContain('Retry in 1 second(s)');
  });

  it('describes 500s as backend internal errors', () => {
    const text = describeToolError(
      axiosError(500, { message: 'Something went wrong', code: 'internal_error' })
    );
    expect(text).toContain('internal error');
    expect(text).toContain('Something went wrong');
  });

  it('reports unexpected statuses verbatim', () => {
    const text = describeToolError(axiosError(418, { message: 'teapot', code: 'teapot' }));
    expect(text).toContain('status 418');
    expect(text).toContain('teapot');
  });

  it('passes through non-HTTP errors', () => {
    expect(describeToolError(new Error('boom'))).toBe('boom');
  });
});
