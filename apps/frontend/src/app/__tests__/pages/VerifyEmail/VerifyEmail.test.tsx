import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import VerifyEmail from '@/app/features/auth/pages/VerifyEmail/VerifyEmail';
import { useAuthStore } from '@/app/stores/authStore';
import { provisionPendingSignUpUser } from '@/app/features/auth/services/provisioning';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

jest.mock('@/app/features/auth/services/provisioning', () => ({
  provisionPendingSignUpUser: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, href }: any) => <a href={href ?? '#'}>{text}</a>,
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: any) => <div data-testid={testId}>{label}</div>,
}));

expect.extend(toHaveNoViolations);

describe('VerifyEmail landing page', () => {
  const mockVerifyEmail = jest.fn();
  const mockCheckSession = jest.fn();
  const mockRouterReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      verifyEmail: mockVerifyEmail,
      checkSession: mockCheckSession,
      role: null,
    });
    (useRouter as jest.Mock).mockReturnValue({ replace: mockRouterReplace });
    (provisionPendingSignUpUser as jest.Mock).mockResolvedValue(undefined);
    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/dashboard');
  });

  const renderVerified = async () => {
    mockVerifyEmail.mockResolvedValue('OK');
    render(<VerifyEmail />);
    await screen.findByRole('heading', { name: 'Email verified' });
  };

  it('shows the verifying state while the token is being checked', () => {
    mockVerifyEmail.mockReturnValue(new Promise(() => undefined));
    render(<VerifyEmail />);

    expect(screen.getByTestId('verify-email-loader')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Verifying...' })).toBeInTheDocument();
  });

  it('shows the success state when the token verifies', async () => {
    await renderVerified();

    expect(mockVerifyEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('shows the expired state for invalid tokens', async () => {
    mockVerifyEmail.mockResolvedValue('INVALID_TOKEN');
    render(<VerifyEmail />);

    await screen.findByRole('heading', { name: 'Verification link expired' });
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/signin');
  });

  it('shows the expired state when verification throws', async () => {
    mockVerifyEmail.mockRejectedValue(new Error('boom'));
    render(<VerifyEmail />);

    await screen.findByRole('heading', { name: 'Verification link expired' });
  });

  it('continues to the app when a session exists', async () => {
    mockCheckSession.mockResolvedValue({ userId: 'user-1' });
    await renderVerified();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(mockCheckSession).toHaveBeenCalled();
    expect(provisionPendingSignUpUser).toHaveBeenCalled();
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith({ fallbackRole: null });
    expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('continues to the app even when provisioning fails', async () => {
    mockCheckSession.mockResolvedValue({ userId: 'user-1' });
    (provisionPendingSignUpUser as jest.Mock).mockRejectedValue(new Error('409ish'));
    await renderVerified();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('sends the user to sign in when no session exists', async () => {
    mockCheckSession.mockResolvedValue(null);
    await renderVerified();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/signin');
    expect(provisionPendingSignUpUser).not.toHaveBeenCalled();
  });

  it('sends the user to sign in when the session check throws', async () => {
    mockCheckSession.mockRejectedValue(new Error('me down'));
    await renderVerified();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/signin');
  });

  it('ignores repeated continue clicks while redirecting', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    mockCheckSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        })
    );
    await renderVerified();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    // First click flips the label; further clicks are no-ops.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Redirecting...' }));
    });
    expect(mockCheckSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSession?.(null);
    });
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/signin'));
  });

  it('has no axe accessibility violations', async () => {
    mockVerifyEmail.mockResolvedValue('OK');
    const { container } = render(<VerifyEmail />);
    await screen.findByRole('heading', { name: 'Email verified' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
