import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import ResetPassword from '@/app/features/auth/pages/ResetPassword/ResetPassword';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';

const showErrorTostMock = jest.fn();
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/ui/inputs/FormInputPass/FormInputPass', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error, inname }: any) => (
    <label>
      {inlabel}
      <input type="password" aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span data-testid={`${inname}-error`}>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, href, isDisabled }: any) =>
    onClick ? (
      <button type="button" onClick={onClick} disabled={isDisabled}>
        {text}
      </button>
    ) : (
      <a href={href}>{text}</a>
    ),
  Secondary: ({ text, href }: any) => <a href={href ?? '#'}>{text}</a>,
}));

expect.extend(toHaveNoViolations);

describe('ResetPassword landing page', () => {
  const mockResetPassword = jest.fn();
  const mockRouterPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ resetPassword: mockResetPassword })
    );
    (useRouter as jest.Mock).mockReturnValue({ push: mockRouterPush });
  });

  const fillPasswords = (password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Enter New Password'), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: confirm },
    });
  };

  const submit = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Reset password|Resetting.../ }));
    });
  };

  it('renders the new password form', () => {
    render(<ResetPassword />);

    expect(screen.getByRole('heading', { name: 'Set new password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Enter New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin'
    );
  });

  it('requires both password fields', async () => {
    render(<ResetPassword />);

    await submit();

    expect(screen.getByText('Enter a new password')).toBeInTheDocument();
    expect(screen.getByText('Confirm your new password')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('rejects weak passwords', async () => {
    render(<ResetPassword />);
    fillPasswords('weak', 'weak');

    await submit();

    expect(
      screen.getByText(
        'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character'
      )
    ).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('requires the confirmation to match', async () => {
    render(<ResetPassword />);
    fillPasswords('Test-password-3!', 'Test-password-4!');

    await submit();

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('requires the confirmation when only the password is set', async () => {
    render(<ResetPassword />);
    fireEvent.change(screen.getByLabelText('Enter New Password'), {
      target: { value: 'Test-password-3!' },
    });

    await submit();

    expect(screen.getByText('Confirm your new password')).toBeInTheDocument();
  });

  it('clears validation errors when the user edits a field', async () => {
    render(<ResetPassword />);
    await submit();
    expect(screen.getByText('Enter a new password')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Enter New Password'), {
      target: { value: 'Test-password-3!' },
    });

    expect(screen.queryByText('Enter a new password')).not.toBeInTheDocument();
  });

  it('submits the new password and routes back to sign in', async () => {
    jest.useFakeTimers();
    mockResetPassword.mockResolvedValue('success');
    render(<ResetPassword />);
    fillPasswords('Test-password-3!', 'Test-password-3!');

    await submit();

    expect(mockResetPassword).toHaveBeenCalledWith('Test-password-3!');
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Password changed successfully. You can now sign in.',
        errortext: 'Success',
      })
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/signin');
  });

  it('shows the expired view for invalid tokens', async () => {
    mockResetPassword.mockRejectedValue(
      Object.assign(new Error('This password reset link is invalid or has expired.'), {
        code: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
      })
    );
    render(<ResetPassword />);
    fillPasswords('Test-password-3!', 'Test-password-3!');

    await submit();

    expect(screen.getByRole('heading', { name: 'Reset link expired' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request new link' })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
    expect(showErrorTostMock).not.toHaveBeenCalled();
  });

  it('shows an error toast for other failures', async () => {
    mockResetPassword.mockRejectedValue(new Error('Password too weak'));
    render(<ResetPassword />);
    fillPasswords('Test-password-3!', 'Test-password-3!');

    await submit();

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Password too weak', errortext: 'Error' })
    );
    expect(screen.getByRole('heading', { name: 'Set new password' })).toBeInTheDocument();
  });

  it('shows a generic message for non-Error failures', async () => {
    mockResetPassword.mockRejectedValue('nope');
    render(<ResetPassword />);
    fillPasswords('Test-password-3!', 'Test-password-3!');

    await submit();

    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Something went wrong' })
    );
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<ResetPassword />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
