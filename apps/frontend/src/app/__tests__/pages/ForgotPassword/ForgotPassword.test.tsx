import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import ForgotPassword from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';
import { useAuthStore } from '@/app/stores/authStore';

const showErrorTostMock = jest.fn();
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/features/marketing/site', () => ({
  AuthShell: ({
    brand,
    topRight,
    children,
  }: {
    brand: React.ReactNode;
    topRight: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <div>{brand}</div>
      <div>{topRight}</div>
      <main>{children}</main>
    </div>
  ),
  AuthBrandContent: () => <div data-testid="auth-brand" />,
}));

expect.extend(toHaveNoViolations);

describe('ForgotPassword page (reset link flow)', () => {
  const forgotPasswordMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { forgotPassword: unknown }) => unknown) =>
        selector({ forgotPassword: forgotPasswordMock })
    );
  });

  const submitEmail = (email = 'user@example.com') => {
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } });
    fireEvent.click(screen.getByRole('button', { name: /Send reset link/ }));
  };

  test('renders the email form', () => {
    render(<ForgotPassword />);

    expect(screen.getByRole('heading', { name: /Reset your password/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send reset link/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin'
    );
  });

  test('shows an inline error when the email is missing', () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole('button', { name: /Send reset link/ }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    const field = screen.getByLabelText('Work email');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    // The inline error is associated with the field so screen readers announce it.
    expect(field).toHaveAttribute('aria-describedby', 'forgot-email-error');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'forgot-email-error');
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  test('validates the email format before sending', () => {
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send reset link/ }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  test('clears the inline error as the user edits the field', () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole('button', { name: /Send reset link/ }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'user@example.com' },
    });

    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
  });

  test('shows the check-your-email confirmation after sending the link', async () => {
    forgotPasswordMock.mockResolvedValue({ status: 'OK' });
    render(<ForgotPassword />);

    submitEmail('user@example.com');

    await screen.findByTestId('forgot-sent');
    expect(forgotPasswordMock).toHaveBeenCalledWith('user@example.com');
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  test('lets the user return to the form to try another email', async () => {
    forgotPasswordMock.mockResolvedValue({ status: 'OK' });
    render(<ForgotPassword />);

    submitEmail();
    await screen.findByTestId('forgot-sent');

    fireEvent.click(screen.getByRole('button', { name: 'try another email' }));

    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.queryByTestId('forgot-sent')).not.toBeInTheDocument();
    // The submit handler cleared `isSubmitting` in its `finally`, so the form the
    // user comes back to is live rather than stuck on a disabled "Sending...".
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  test('surfaces a toast when the request fails and stays on the form', async () => {
    forgotPasswordMock.mockRejectedValue(new Error('Not allowed'));
    render(<ForgotPassword />);

    submitEmail();

    await waitFor(() =>
      expect(showErrorTostMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Not allowed', errortext: 'Error' })
      )
    );
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  test('treats a not-allowed reset as a neutral confirmation without leaking the reason', async () => {
    // SuperTokens' account-takeover protection: the reason must never reach the user.
    const notAllowed = Object.assign(new Error('User signed up with a social login'), {
      code: 'PASSWORD_RESET_NOT_ALLOWED',
    });
    forgotPasswordMock.mockRejectedValue(notAllowed);
    render(<ForgotPassword />);

    submitEmail('user@example.com');

    await screen.findByTestId('forgot-sent');
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    // No toast, and the backend reason is nowhere in the DOM.
    expect(showErrorTostMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/social login/i)).not.toBeInTheDocument();
  });

  test('shows a generic message when the failure is not an Error object', async () => {
    forgotPasswordMock.mockRejectedValue('boom');
    render(<ForgotPassword />);

    submitEmail();

    await waitFor(() =>
      expect(showErrorTostMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'We could not send the reset email. Please try again.',
        })
      )
    );
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<ForgotPassword />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
