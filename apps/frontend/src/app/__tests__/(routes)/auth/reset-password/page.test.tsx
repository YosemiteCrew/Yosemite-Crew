import Page from '@/app/(routes)/(public)/auth/reset-password/page';

const redirectMock = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe('Auth reset-password redirect route', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('forwards to /reset-password preserving the reset token query', async () => {
    await Page({
      searchParams: Promise.resolve({ token: 'abc123', tenantId: 'public', rid: 'emailpassword' }),
    });
    expect(redirectMock).toHaveBeenCalledWith(
      '/reset-password?token=abc123&tenantId=public&rid=emailpassword'
    );
  });

  it('forwards to /reset-password when there is no query', async () => {
    await Page({ searchParams: Promise.resolve({}) });
    expect(redirectMock).toHaveBeenCalledWith('/reset-password');
  });

  it('takes the first value of a repeated query param and skips empty ones', async () => {
    await Page({
      searchParams: Promise.resolve({ token: ['first', 'second'], empty: undefined }),
    });
    expect(redirectMock).toHaveBeenCalledWith('/reset-password?token=first');
  });
});
