import { buildForwardedAuthLink } from '@/app/features/auth/lib/authLinkForwarding';

describe('buildForwardedAuthLink', () => {
  it('preserves the token and every other query param', () => {
    expect(
      buildForwardedAuthLink('/verify-email', {
        token: 'abc123',
        tenantId: 'public',
        rid: 'emailverification',
      })
    ).toBe('/verify-email?token=abc123&tenantId=public&rid=emailverification');
  });

  it('returns the bare destination when there is no query', () => {
    expect(buildForwardedAuthLink('/reset-password', {})).toBe('/reset-password');
  });

  it('takes the first value of a repeated param', () => {
    expect(buildForwardedAuthLink('/verify-email', { token: ['first', 'second'] })).toBe(
      '/verify-email?token=first'
    );
  });

  it('drops an undefined param rather than serialising it', () => {
    expect(buildForwardedAuthLink('/verify-email', { token: 'abc', empty: undefined })).toBe(
      '/verify-email?token=abc'
    );
  });

  it('drops a repeated param whose first value is missing', () => {
    expect(buildForwardedAuthLink('/verify-email', { token: 'abc', stray: [] })).toBe(
      '/verify-email?token=abc'
    );
  });

  // The token is the whole point of the link. A forward that silently dropped or
  // mangled it would still produce a valid-looking URL and a 200, while leaving
  // the account unverified.
  it('percent-encodes a token that contains URL-significant characters', () => {
    const target = buildForwardedAuthLink('/verify-email', { token: 'a+b/c=d&e' });
    expect(new URLSearchParams(target.split('?')[1]).get('token')).toBe('a+b/c=d&e');
  });

  it('keeps the destination and the query separate', () => {
    expect(
      buildForwardedAuthLink('/verify-email', { token: 't' }).startsWith('/verify-email?')
    ).toBe(true);
  });
});
