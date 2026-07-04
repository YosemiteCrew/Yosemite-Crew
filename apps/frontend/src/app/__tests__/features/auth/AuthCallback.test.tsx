import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const completeGithubSignIn = jest.fn();
jest.mock('@/app/features/auth/lib/githubOAuth', () => ({
  completeGithubSignIn: (args: unknown) => completeGithubSignIn(args),
}));

const establishFederatedSession = jest.fn();
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: (state: { establishFederatedSession: unknown }) => unknown) =>
    selector({ establishFederatedSession }),
}));

const replace = jest.fn();
let params: Record<string, string>;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: (key: string) => params[key] ?? null }),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: { label: string; testId: string }) => (
    <div data-testid={testId}>{label}</div>
  ),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import AuthCallback from '@/app/features/auth/pages/AuthCallback/AuthCallback';

describe('AuthCallback', () => {
  beforeEach(() => {
    completeGithubSignIn.mockReset();
    establishFederatedSession.mockReset();
    replace.mockReset();
    params = {};
  });

  it('exchanges the code, establishes the session, and redirects', async () => {
    params = { code: 'code123', state: 'state123' };
    completeGithubSignIn.mockResolvedValue({
      tokens: { idToken: 'i', accessToken: 'a', refreshToken: 'r' },
      redirectTo: '/developers/home',
    });
    establishFederatedSession.mockResolvedValue({});

    render(<AuthCallback />);
    expect(screen.getByTestId('github-callback-loader')).toBeInTheDocument();

    await waitFor(() =>
      expect(establishFederatedSession).toHaveBeenCalledWith({
        idToken: 'i',
        accessToken: 'a',
        refreshToken: 'r',
      })
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/developers/home'));
  });

  it('shows an error when the provider returns an error param', () => {
    params = { error: 'access_denied' };
    render(<AuthCallback />);
    expect(screen.getByText(/cancelled or did not complete/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/signin'
    );
    expect(completeGithubSignIn).not.toHaveBeenCalled();
  });

  it('shows an error when code or state is missing', () => {
    params = { code: 'code123' };
    render(<AuthCallback />);
    expect(screen.getByText(/missing information/i)).toBeInTheDocument();
  });

  it('surfaces the error message when the exchange fails', async () => {
    params = { code: 'code123', state: 'state123' };
    completeGithubSignIn.mockRejectedValue(new Error('token exchange failed'));
    render(<AuthCallback />);
    await waitFor(() => expect(screen.getByText('token exchange failed')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    params = { code: 'code123', state: 'state123' };
    completeGithubSignIn.mockRejectedValue('oops');
    render(<AuthCallback />);
    await waitFor(() =>
      expect(screen.getByText(/could not complete github sign in/i)).toBeInTheDocument()
    );
  });

  it('has no accessibility violations on the error screen', async () => {
    params = { error: 'access_denied' };
    const { container } = render(<AuthCallback />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
