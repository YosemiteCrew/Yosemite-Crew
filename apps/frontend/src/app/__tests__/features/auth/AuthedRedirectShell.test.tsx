import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const redirect = jest.fn();
jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

let mockState: { status: string; role: string };
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: (state: { status: string; role: string }) => unknown) =>
    selector(mockState),
}));

const resolvePostAuthRedirect = jest.fn();
jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: (args: unknown) => resolvePostAuthRedirect(args),
}));

import AuthedRedirectShell from '@/app/features/auth/pages/AuthedRedirectShell';

describe('AuthedRedirectShell', () => {
  beforeEach(() => {
    redirect.mockReset();
    resolvePostAuthRedirect.mockReset();
    mockState = { status: 'unauthenticated', role: 'member' };
  });

  it('renders its children when the visitor is not authenticated', () => {
    render(
      <AuthedRedirectShell>
        <div>auth screen</div>
      </AuthedRedirectShell>
    );
    expect(screen.getByText('auth screen')).toBeInTheDocument();
    expect(resolvePostAuthRedirect).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('forwards an already-authenticated visitor to their post-auth route', async () => {
    mockState = { status: 'authenticated', role: 'admin' };
    resolvePostAuthRedirect.mockResolvedValue('/dashboard');

    render(
      <AuthedRedirectShell>
        <div>auth screen</div>
      </AuthedRedirectShell>
    );

    // The auth screen is never painted for a visitor who is on their way elsewhere.
    expect(screen.queryByText('auth screen')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(resolvePostAuthRedirect).toHaveBeenCalledWith({ fallbackRole: 'admin' })
    );
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/dashboard'));
  });
});
