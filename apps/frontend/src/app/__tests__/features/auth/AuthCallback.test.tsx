import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

const completeGithubSignIn = jest.fn();
jest.mock('@/app/features/auth/lib/githubOAuth', () => ({
  completeGithubSignIn: () => completeGithubSignIn(),
}));

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
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
    replace.mockReset();
  });

  it('shows the loader, completes the handshake, and redirects to the resolved target', async () => {
    completeGithubSignIn.mockResolvedValue({ redirectTo: '/developers/home' });

    render(<AuthCallback />);
    expect(screen.getByTestId('github-callback-loader')).toBeInTheDocument();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/developers/home'));
    expect(completeGithubSignIn).toHaveBeenCalledTimes(1);
  });

  it('runs the handshake only once even when the component re-renders', async () => {
    completeGithubSignIn.mockResolvedValue({ redirectTo: '/developers/home' });

    const { rerender } = render(<AuthCallback />);
    rerender(<AuthCallback />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/developers/home'));
    expect(completeGithubSignIn).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error message and a back-to-sign-in link when the handshake fails', async () => {
    completeGithubSignIn.mockRejectedValue(new Error('GitHub did not share an email.'));

    render(<AuthCallback />);

    await waitFor(() =>
      expect(screen.getByText('GitHub did not share an email.')).toBeInTheDocument()
    );
    expect(screen.getByRole('heading', { name: /sign in interrupted/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/signin'
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    completeGithubSignIn.mockRejectedValue('boom');

    render(<AuthCallback />);

    await waitFor(() =>
      expect(screen.getByText(/could not complete github sign in/i)).toBeInTheDocument()
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('has no accessibility violations on the error screen', async () => {
    completeGithubSignIn.mockRejectedValue(new Error('Sign in failed.'));

    const { container } = render(<AuthCallback />);
    await screen.findByText('Sign in failed.');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
