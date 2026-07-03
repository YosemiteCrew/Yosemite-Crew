import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

const showErrorTostMock = jest.fn();
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

const authStoreMock: {
  forgotPassword: jest.Mock;
} = {
  forgotPassword: jest.fn(),
};
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => authStoreMock,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({
    text,
    onClick,
  }: {
    text: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <button
      type="button"
      onClick={(e) => onClick?.(e as unknown as React.MouseEvent<HTMLAnchorElement>)}
    >
      {text}
    </button>
  ),
  Secondary: ({
    text,
    href,
    onClick,
  }: {
    text: string;
    href?: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a href={href ?? '#'} onClick={(e) => onClick?.(e)}>
      {text}
    </a>
  ),
}));

import ForgotPassword from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';

expect.extend(toHaveNoViolations);

describe('ForgotPassword page (reset link flow)', () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { scrollTo: jest.Mock }).scrollTo = jest.fn();
  });

  beforeEach(() => {
    authStoreMock.forgotPassword.mockReset();
    showErrorTostMock.mockReset();
  });

  const requestLink = async (email = 'user@example.com') => {
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: email },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(authStoreMock.forgotPassword).toHaveBeenCalled());
  };

  test('renders the initial email form', () => {
    render(<ForgotPassword />);

    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
    expect(screen.getByText(/send you a link to reset it/i)).toBeInTheDocument();
  });

  test('requires email before sending the link and exposes inline email error', () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true');
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email is required' })
    );
    expect(authStoreMock.forgotPassword).not.toHaveBeenCalled();
  });

  test('validates the email format before sending the link', () => {
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Enter a valid email' })
    );
    expect(authStoreMock.forgotPassword).not.toHaveBeenCalled();
  });

  test('clears the inline email error when the user edits the field', () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    });

    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  test('moves to the check-your-email step after requesting the link', async () => {
    authStoreMock.forgotPassword.mockResolvedValue({ status: 'OK' });
    render(<ForgotPassword />);

    await requestLink();

    expect(authStoreMock.forgotPassword).toHaveBeenCalledWith('user@example.com');
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText(/link in the email to set a new password/)).toBeInTheDocument();
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ errortext: 'Success' })
    );
  });

  test('resends the link from the check-your-email step', async () => {
    authStoreMock.forgotPassword.mockResolvedValue({ status: 'OK' });
    render(<ForgotPassword />);

    await requestLink();
    await screen.findByRole('heading', { name: 'Check your email' });

    authStoreMock.forgotPassword.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Resend link' }));

    await waitFor(() =>
      expect(authStoreMock.forgotPassword).toHaveBeenCalledWith('user@example.com')
    );
  });

  test('offers a way back to sign in from both steps', async () => {
    authStoreMock.forgotPassword.mockResolvedValue({ status: 'OK' });
    render(<ForgotPassword />);

    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/signin');

    await requestLink();
    await screen.findByRole('heading', { name: 'Check your email' });

    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin'
    );
  });

  test('surfaces request failures with the provider message', async () => {
    authStoreMock.forgotPassword.mockRejectedValue(new Error('Not allowed'));
    render(<ForgotPassword />);

    await requestLink();

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Reset link failed: Not allowed' })
    );
    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
  });

  test('falls back to a connectivity message for non-Error failures', async () => {
    authStoreMock.forgotPassword.mockRejectedValue('boom');
    render(<ForgotPassword />);

    await requestLink();

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Reset link failed: Unable to connect to the server.',
      })
    );
  });

  test('stays on the email step when the store resolves nothing', async () => {
    authStoreMock.forgotPassword.mockResolvedValue(null);
    render(<ForgotPassword />);

    await requestLink();

    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<ForgotPassword />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
