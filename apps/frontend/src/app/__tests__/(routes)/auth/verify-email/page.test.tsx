import Page from '@/app/(routes)/(public)/auth/verify-email/page';

const redirectMock = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe('Auth verify-email redirect route', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('forwards to /verify-email preserving the verification token query', async () => {
    await Page({
      searchParams: Promise.resolve({
        token: 'abc123',
        tenantId: 'public',
        rid: 'emailverification',
      }),
    });
    expect(redirectMock).toHaveBeenCalledWith(
      '/verify-email?token=abc123&tenantId=public&rid=emailverification'
    );
  });

  it('forwards to /verify-email when there is no query', async () => {
    await Page({ searchParams: Promise.resolve({}) });
    expect(redirectMock).toHaveBeenCalledWith('/verify-email');
  });

  it('takes the first value of a repeated query param and skips empty ones', async () => {
    await Page({
      searchParams: Promise.resolve({ token: ['first', 'second'], empty: undefined }),
    });
    expect(redirectMock).toHaveBeenCalledWith('/verify-email?token=first');
  });

  // The token is the whole point of the link: a redirect that dropped it would
  // still return 200 and still look fixed, while leaving the account unverified.
  it('never forwards without the token that was supplied', async () => {
    await Page({ searchParams: Promise.resolve({ token: 'tok_9f3a' }) });
    const target = redirectMock.mock.calls[0][0] as string;
    expect(target.startsWith('/verify-email?')).toBe(true);
    expect(new URLSearchParams(target.split('?')[1]).get('token')).toBe('tok_9f3a');
  });
});
