import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  resetPassword: jest.Mock;
} = {
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => authStoreMock,
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
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
    onClick,
  }: {
    text: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <button type="button" onClick={() => onClick?.({} as React.MouseEvent<HTMLAnchorElement>)}>
      {text}
    </button>
  ),
}));

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import ForgotPassword from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';

expect.extend(toHaveNoViolations);

describe('ForgotPassword page', () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { scrollTo: jest.Mock }).scrollTo = jest.fn();
  });

  beforeEach(() => {
    jest.useRealTimers();
    authStoreMock.forgotPassword.mockReset();
    authStoreMock.resetPassword.mockReset();
    showErrorTostMock.mockReset();
    mockRouterPush.mockReset();
  });

  test('requires email before sending code and exposes inline email error', () => {
    render(<ForgotPassword />);

    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true');
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email is required' })
    );
    expect(authStoreMock.forgotPassword).not.toHaveBeenCalled();
  });

  test('moves to verify step after requesting OTP', async () => {
    authStoreMock.forgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() =>
      expect(authStoreMock.forgotPassword).toHaveBeenCalledWith('user@example.com')
    );
    await screen.findByRole('heading', { name: 'Verify code' });
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument();
    expect(screen.getByText('Enter the 6-digit code from your email.')).toBeInTheDocument();
  });

  test('requires full OTP before verifying and surfaces group error text', async () => {
    authStoreMock.forgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByRole('group', { name: 'Verification code' });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    expect(screen.getByText('Enter the full 6-digit verification code')).toBeInTheDocument();
    expect(showErrorTostMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Please enter the full OTP' })
    );
  });

  test('validates password fields inline before reset', async () => {
    authStoreMock.forgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('group', { name: 'Verification code' });

    for (let index = 0; index < 6; index += 1) {
      fireEvent.change(screen.getByLabelText(`Digit ${index + 1} of 6`), {
        target: { value: String(index + 1) },
      });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await screen.findByRole('heading', { name: 'Set new password' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(screen.getByText('Enter a new password')).toBeInTheDocument();
    expect(screen.getByText('Confirm your new password')).toBeInTheDocument();
  });

  test('resets password after verifying code', async () => {
    jest.useFakeTimers();
    authStoreMock.forgotPassword.mockResolvedValue(true);
    authStoreMock.resetPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByRole('group', { name: 'Verification code' });

    for (let index = 0; index < 6; index += 1) {
      fireEvent.change(screen.getByLabelText(`Digit ${index + 1} of 6`), {
        target: { value: String(index + 1) },
      });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await screen.findByRole('heading', { name: 'Set new password' });

    fireEvent.change(screen.getByLabelText('Enter New Password'), {
      target: { value: 'Secret!23' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'Secret!23' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(authStoreMock.resetPassword).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        'Secret!23'
      )
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/signin');
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<ForgotPassword />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
