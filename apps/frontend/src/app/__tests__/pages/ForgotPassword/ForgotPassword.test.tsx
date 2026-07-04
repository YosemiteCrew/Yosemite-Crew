import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForgotPassword from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';
import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';

// --- Mocks ---

// 1. Mock Next.js Router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// 2. Mock Toast Hook
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: jest.fn(),
}));

// 3. Mock Auth Store
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// 4. Mock the shared marketing foundation (AuthShell / AuthBrandContent) so its
// GitHub-stats hook and next/image assets don't hit the network in jsdom.
jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  AuthBrandContent: () => <div data-testid="auth-brand" />,
  AuthShell: ({ brand, topRight, children }: any) => (
    <div data-testid="auth-shell">
      <div>{brand}</div>
      <div>{topRight}</div>
      <main>{children}</main>
    </div>
  ),
}));

const getEmailInput = () => screen.getByRole('textbox', { name: /email address/i });
const getSendCodeBtn = () => screen.getByRole('button', { name: /send code/i });
const getVerifyCodeBtn = () => screen.getByRole('button', { name: /verify code/i });
const getResetPasswordBtn = () => screen.getByRole('button', { name: /reset password/i });
const getBackButtons = () => screen.getAllByRole('button', { name: /^back$/i });

describe('ForgotPassword Page', () => {
  const mockPush = jest.fn();
  const mockShowErrorTost = jest.fn();
  const mockForgotPassword = jest.fn();
  const mockResetPassword = jest.fn();

  beforeAll(() => {
    window.scrollTo = jest.fn();
    // Fix for JSDOM missing implementation
    HTMLFormElement.prototype.requestSubmit = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useErrorTost as jest.Mock).mockReturnValue({
      showErrorTost: mockShowErrorTost,
      ErrorTostPopup: <div data-testid="toast-popup" />,
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      forgotPassword: mockForgotPassword,
      resetPassword: mockResetPassword,
    });
  });

  // --- Section 1: Email View & Interactions ---

  it('renders the initial email form correctly', () => {
    render(<ForgotPassword />);
    expect(screen.getByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(getEmailInput()).toBeInTheDocument();
    expect(getSendCodeBtn()).toBeInTheDocument();
  });

  it('validates empty email submission', () => {
    render(<ForgotPassword />);
    fireEvent.click(getSendCodeBtn());

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email is required' })
    );
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('validates invalid email submission', () => {
    render(<ForgotPassword />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(getSendCodeBtn());

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Enter a valid email' })
    );
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('handles forgotPassword API success', async () => {
    mockForgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });

    await act(async () => {
      fireEvent.click(getSendCodeBtn());
    });

    expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ errortext: 'Success' })
    );
  });

  it('handles forgotPassword API failure (Axios Error)', async () => {
    const errorResponse = {
      response: { data: { message: 'User not found' } },
    };
    mockForgotPassword.mockRejectedValue(errorResponse);

    render(<ForgotPassword />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });

    await act(async () => {
      fireEvent.click(getSendCodeBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'OTP failed: User not found' })
    );
  });

  it('handles forgotPassword API failure (Network Error fallback)', async () => {
    mockForgotPassword.mockRejectedValue(new Error('Network Error'));

    render(<ForgotPassword />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });

    await act(async () => {
      fireEvent.click(getSendCodeBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'OTP failed: Unable to connect to the server.',
      })
    );
  });

  // --- Section 2: OTP View & Interactions ---

  const navigateToOtpScreen = async () => {
    mockForgotPassword.mockResolvedValue(true);
    render(<ForgotPassword />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    await act(async () => {
      fireEvent.click(getSendCodeBtn());
    });
  };

  it('handles OTP input changes and auto-focus logic', async () => {
    await navigateToOtpScreen();

    const input0 = document.getElementById('otp-input-0') as HTMLInputElement;
    const input1 = document.getElementById('otp-input-1') as HTMLInputElement;

    const focusSpy = jest.spyOn(input1, 'focus');

    fireEvent.change(input0, { target: { value: '1' } });

    expect(input0.value).toBe('1');
    expect(focusSpy).toHaveBeenCalled();
  });

  it('prevents entering more than 1 character in OTP field', async () => {
    await navigateToOtpScreen();
    const input0 = document.getElementById('otp-input-0') as HTMLInputElement;

    fireEvent.change(input0, { target: { value: '12' } });

    expect(input0.value).toBe('');
  });

  it('handles Backspace navigation in OTP fields', async () => {
    await navigateToOtpScreen();
    const input0 = document.getElementById('otp-input-0') as HTMLInputElement;
    const input1 = document.getElementById('otp-input-1') as HTMLInputElement;

    const focusSpy = jest.spyOn(input0, 'focus');

    fireEvent.keyDown(input1, { key: 'Backspace' });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("handles 'Request New Code' link", async () => {
    await navigateToOtpScreen();

    mockForgotPassword.mockClear();

    const resendLink = screen.getByText('Request New Code');
    await act(async () => {
      fireEvent.click(resendLink);
    });

    expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
  });

  it('validates incomplete OTP', async () => {
    await navigateToOtpScreen();

    await act(async () => {
      fireEvent.click(getVerifyCodeBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Please enter the full OTP' })
    );
  });

  it('transitions to New Password view on valid OTP', async () => {
    await navigateToOtpScreen();

    [0, 1, 2, 3, 4, 5].forEach((i) => {
      fireEvent.change(document.getElementById(`otp-input-${i}`)!, {
        target: { value: '1' },
      });
    });

    await act(async () => {
      fireEvent.click(getVerifyCodeBtn());
    });

    expect(screen.getByRole('heading', { name: 'Set new password' })).toBeInTheDocument();
    expect(getResetPasswordBtn()).toBeInTheDocument();
  });

  it('OTP Back button returns to Email view', async () => {
    await navigateToOtpScreen();

    // On the verify step there is a single "Back" button.
    fireEvent.click(getBackButtons()[0]);

    expect(getSendCodeBtn()).toBeInTheDocument();
  });

  // --- Section 3: Password View & Reset Logic ---

  const navigateToPasswordScreen = async () => {
    await navigateToOtpScreen();
    [0, 1, 2, 3, 4, 5].forEach((i) => {
      fireEvent.change(document.getElementById(`otp-input-${i}`)!, {
        target: { value: '1' },
      });
    });
    await act(async () => {
      fireEvent.click(getVerifyCodeBtn());
    });
  };

  it('validates empty passwords', async () => {
    await navigateToPasswordScreen();

    await act(async () => {
      fireEvent.click(getResetPasswordBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Both Passwords are required' })
    );
  });

  it('Password View Back button returns to Email view', async () => {
    await navigateToPasswordScreen();

    fireEvent.click(getBackButtons()[0]);

    expect(getSendCodeBtn()).toBeInTheDocument();
  });
});
