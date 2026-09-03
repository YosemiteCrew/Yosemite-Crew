import { describeToolError, isAxiosErrorLike, toYcApiError, YcApiError } from '../src/errors.js';
import { axiosFailure } from './helpers.js';

describe('isAxiosErrorLike', () => {
  it.each([
    ['a plain object', {}],
    ['null', null],
    ['a string', 'nope'],
  ])('rejects %s', (_label, value) => {
    expect(isAxiosErrorLike(value)).toBe(false);
  });

  it('accepts a structurally axios-shaped error', () => {
    expect(isAxiosErrorLike(axiosFailure(404))).toBe(true);
  });
});

describe('toYcApiError', () => {
  it('passes an existing YcApiError through untouched', () => {
    const original = new YcApiError('already mapped', { status: 400 });
    expect(toYcApiError(original)).toBe(original);
  });

  it('explains a transport failure rather than reporting a status', () => {
    const mapped = toYcApiError({ isAxiosError: true, message: 'ECONNREFUSED' });
    expect(mapped.status).toBeUndefined();
    expect(mapped.message).toContain('YC_API_BASE_URL');
  });

  it('reads the { message, code } envelope the controllers send', () => {
    const mapped = toYcApiError(
      axiosFailure(400, { message: 'Unknown or malformed cursor', code: 'invalid_request' })
    );
    expect(mapped).toMatchObject({
      status: 400,
      code: 'invalid_request',
      message: 'Unknown or malformed cursor',
    });
  });

  /*
   * The shared middleware answers with a bare { message } and no code. Reading
   * the envelope must not blank the message out when the code is absent.
   */
  it('handles the code-less envelope the auth and RBAC middleware send', () => {
    const mapped = toYcApiError(
      axiosFailure(403, { message: 'Insufficient scope for this API key' })
    );
    expect(mapped.code).toBeUndefined();
    expect(mapped.message).toBe('Insufficient scope for this API key');
  });

  it('falls back to the status when the body is not an envelope', () => {
    expect(toYcApiError(axiosFailure(500, '<html>502</html>')).message).toContain('HTTP 500');
  });

  it('maps a non-axios throwable', () => {
    expect(toYcApiError(new Error('boom')).message).toBe('boom');
    expect(toYcApiError('boom').message).toBe('boom');
  });
});

describe('describeToolError', () => {
  it.each([
    [401, 'YC_API_KEY'],
    [403, 'not an active member'],
    [404, 'does not distinguish'],
    [429, 'quota'],
  ])('adds actionable guidance for %s', (status, fragment) => {
    expect(describeToolError(axiosFailure(status, { message: 'nope' }))).toContain(fragment);
  });

  it('names the missing scope on a 403 so the agent can say which one', () => {
    const text = describeToolError(axiosFailure(403, { message: 'nope' }), 'appointments:read');
    expect(text).toContain('"appointments:read"');
  });

  it('does not invent guidance for an unmapped status', () => {
    expect(describeToolError(axiosFailure(418, { message: 'teapot' }))).toBe('teapot');
  });
});
