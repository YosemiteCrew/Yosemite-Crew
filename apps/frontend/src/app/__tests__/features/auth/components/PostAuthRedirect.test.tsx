import { render, waitFor } from '@testing-library/react';
import PostAuthRedirect from '@/app/features/auth/components/PostAuthRedirect';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

// jest.setup.ts mocks next/navigation without `redirect`, so it is declared here.
const redirectMock = jest.fn();
jest.mock('next/navigation', () => ({ redirect: (route: string) => redirectMock(route) }));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

const resolveMock = resolvePostAuthRedirect as jest.Mock;

describe('PostAuthRedirect', () => {
  beforeEach(() => {
    resolveMock.mockResolvedValue('/dashboard');
  });

  it('renders nothing before the destination resolves', () => {
    resolveMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PostAuthRedirect />);
    expect(container).toBeEmptyDOMElement();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects once the destination resolves', async () => {
    render(<PostAuthRedirect />);
    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('passes the fallback role through to the resolver', async () => {
    render(<PostAuthRedirect fallbackRole="VETERINARIAN" />);
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith({ fallbackRole: 'VETERINARIAN' }));
  });

  it('does not redirect when the resolver settles after unmount', async () => {
    let settle: (route: string) => void = () => {};
    resolveMock.mockReturnValue(
      new Promise<string>((resolve) => {
        settle = resolve;
      })
    );

    const { unmount } = render(<PostAuthRedirect />);
    unmount();
    settle('/late');
    await Promise.resolve();

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
