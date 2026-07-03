import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SignIn from '@/app/features/auth/pages/SignIn/SignIn';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';
import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';
import { provisionPendingSignUpUser } from '@/app/features/auth/services/provisioning';

// --- Mocks ---

// Mock Next.js Navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Auth Store (hook + getState consumer)
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));

// Mock Toast
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

jest.mock('@/app/features/auth/services/provisioning', () => ({
  provisionPendingSignUpUser: jest.fn(),
}));

// Mock Components
jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, error, inlabel, inname }: any) => (
    <div data-testid={`${inname}-input-wrapper`}>
      <label htmlFor={`signin-${inname}`}>{inlabel}</label>
      <input
        id={`signin-${inname}`}
        data-testid={`${inname}-input`}
        value={value}
        onChange={onChange}
      />
      {error && <span data-testid={`${inname}-error`}>{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormInputPass/FormInputPass', () => ({
  __esModule: true,
  default: ({ value, onChange, error, inlabel }: any) => (
    <div data-testid="password-input-wrapper">
      <label htmlFor="signin-password">{inlabel}</label>
      <input
        id="signin-password"
        data-testid="password-input"
        value={value}
        onChange={onChange}
        type="password"
      />
      {error && <span data-testid="password-error">{error}</span>}
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/OtpModal/OtpModal', () => ({
  __esModule: true,
  default: ({ showVerifyModal }: any) =>
    showVerifyModal ? <div data-testid="otp-modal">Verification Modal Open</div> : null,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button data-testid="signin-btn" onClick={onClick} disabled={isDisabled}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button data-testid="secondary-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: any) => <div data-testid={testId}>{label}</div>,
}));

// Mock Storage
const mockSessionStorage = {
  setItem: jest.fn(),
};
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
});
Object.defineProperty(globalThis, 'scrollTo', {
  value: jest.fn(),
});

expect.extend(toHaveNoViolations);

describe('SignIn Page', () => {
  const mockSignIn = jest.fn();
  const mockCompleteTotpChallenge = jest.fn();
  const mockCompleteEmailOtpChallenge = jest.fn();
  const mockRequestEmailOtp = jest.fn();
  const mockSignout = jest.fn();
  const mockRouterPush = jest.fn();
  const mockRouterReplace = jest.fn();
  const mockShowErrorTost = jest.fn();

  const fillCredentials = (email = 'test@example.com', password = 'pass123') => {
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: email } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: password } });
  };

  const submitSignIn = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId('signin-btn'));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      completeTotpChallenge: mockCompleteTotpChallenge,
      completeEmailOtpChallenge: mockCompleteEmailOtpChallenge,
      requestEmailOtp: mockRequestEmailOtp,
      role: null,
    });
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      role: null,
      signout: mockSignout,
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
      replace: mockRouterReplace,
    });

    (useErrorTost as jest.Mock).mockReturnValue({
      showErrorTost: mockShowErrorTost,
      ErrorTostPopup: <div data-testid="toast-popup" />,
    });

    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/create-org');
    (provisionPendingSignUpUser as jest.Mock).mockResolvedValue(undefined);
    mockRequestEmailOtp.mockResolvedValue(undefined);
    mockSignout.mockResolvedValue(undefined);
  });

  // --- 1. Rendering ---

  it('renders the sign-in form correctly (default mode)', () => {
    render(<SignIn />);

    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByTestId('signin-btn')).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toHaveAttribute('href', '/signup');
  });

  it('renders correctly in developer mode', () => {
    render(<SignIn isDeveloper={true} signupHref="/dev-signup" />);

    expect(screen.getByText('Sign in to your developer account')).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toHaveAttribute('href', '/dev-signup');
  });

  // --- 2. Input & Validation ---

  it('updates state on input change', () => {
    render(<SignIn />);

    const emailInput = screen.getByTestId('email-input');
    const passInput = screen.getByTestId('password-input');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passInput).toHaveValue('password123');
  });

  it('shows validation errors when fields are empty', () => {
    render(<SignIn />);

    fireEvent.click(screen.getByTestId('signin-btn'));

    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('clears the password validation error when the user edits the password field', () => {
    render(<SignIn />);

    fireEvent.click(screen.getByTestId('signin-btn'));
    expect(screen.getByTestId('password-error')).toHaveTextContent('Password is required');

    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'updated-password' },
    });

    expect(screen.queryByTestId('password-error')).not.toBeInTheDocument();
  });

  it('shows a validation error for an invalid email format', () => {
    render(<SignIn />);

    fireEvent.change(screen.getByTestId('email-input'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('signin-btn'));

    expect(screen.getByTestId('email-error')).toHaveTextContent('Enter a valid email');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  // --- 3. Success Flow ---

  it('calls signIn, provisions pending sign-ups, and redirects on success', async () => {
    mockSignIn.mockResolvedValue({ status: 'OK' });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'pass123');
    expect(provisionPendingSignUpUser).toHaveBeenCalled();
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith({
      fallbackRole: null,
      redirectPath: undefined,
      isDeveloper: false,
    });
    expect(mockRouterReplace).toHaveBeenCalledWith('/create-org');
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('devAuth', 'false');
  });

  it('sets devAuth to true in storage when isDeveloper is true', async () => {
    mockSignIn.mockResolvedValue({ status: 'OK' });

    render(<SignIn isDeveloper={true} />);
    fillCredentials('dev@example.com');
    await submitSignIn();

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('devAuth', 'true');
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith({
      fallbackRole: null,
      redirectPath: undefined,
      isDeveloper: true,
    });
  });

  it('signs the user out when post-signup provisioning fails', async () => {
    mockSignIn.mockResolvedValue({ status: 'OK' });
    (provisionPendingSignUpUser as jest.Mock).mockRejectedValue(new Error('provisioning down'));

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockSignout).toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sign in failed' })
    );
  });

  it('shows a loader while the sign-in request is pending', async () => {
    let resolveSignIn: (() => void) | undefined;
    mockSignIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = () => resolve({ status: 'OK' });
        })
    );

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(screen.getByTestId('signin-loader')).toHaveTextContent('Signing you in...');
    expect(screen.getByTestId('signin-btn')).toBeDisabled();

    await act(async () => {
      resolveSignIn?.();
    });
  });

  // --- 4. Error Handling & Edge Cases ---

  it('handles generic sign-in error', async () => {
    mockSignIn.mockRejectedValue(new Error('Incorrect username or password.'));

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Incorrect username or password.',
        errortext: 'Error',
      })
    );
  });

  it('uses default error message if error object has no message', async () => {
    mockSignIn.mockRejectedValue({}); // No message

    render(<SignIn />);
    fillCredentials('t@t.com', 'p');
    await submitSignIn();

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sign in failed' })
    );
  });

  // --- 5. Email verification required ---

  it('shows the verification modal when the account email is unverified', async () => {
    mockSignIn.mockResolvedValue({ status: 'EMAIL_VERIFICATION_REQUIRED' });

    render(<SignIn />);
    fillCredentials('unconfirmed@test.com');
    await submitSignIn();

    expect(screen.getByTestId('otp-modal')).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // --- 6. MFA challenge ---

  it('shows the email OTP challenge and requests a code', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['otp-email'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockRequestEmailOtp).toHaveBeenCalled();
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument();
    expect(
      screen.getByText('We sent a 6-digit code to your email. Enter it below to continue.')
    ).toBeInTheDocument();
  });

  it('surfaces a toast when the email OTP request fails', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['otp-email'] });
    mockRequestEmailOtp.mockRejectedValue(new Error('mail down'));

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'mail down' })
    );
  });

  it('shows the authenticator prompt for the TOTP factor without requesting a code', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    expect(mockRequestEmailOtp).not.toHaveBeenCalled();
    expect(
      screen.getByText('Enter the 6-digit code from your authenticator app.')
    ).toBeInTheDocument();
  });

  it('completes the email OTP challenge and redirects', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['otp-email'] });
    mockCompleteEmailOtpChallenge.mockResolvedValue({ status: 'OK' });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    fireEvent.change(screen.getByTestId('mfa-code-input'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    });

    expect(mockCompleteEmailOtpChallenge).toHaveBeenCalledWith('123456');
    expect(mockRouterReplace).toHaveBeenCalledWith('/create-org');
  });

  it('completes the TOTP challenge and redirects', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });
    mockCompleteTotpChallenge.mockResolvedValue({ status: 'OK' });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    fireEvent.change(screen.getByTestId('mfa-code-input'), { target: { value: '654321' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    });

    expect(mockCompleteTotpChallenge).toHaveBeenCalledWith('654321');
    expect(mockRouterReplace).toHaveBeenCalledWith('/create-org');
  });

  it('requires a code before verifying the challenge', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    });

    expect(screen.getByTestId('mfa-code-error')).toHaveTextContent('Enter the 6-digit code');
    expect(mockCompleteTotpChallenge).not.toHaveBeenCalled();
  });

  it('shows the challenge error when the code is rejected', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });
    mockCompleteTotpChallenge.mockRejectedValue(new Error('Invalid code. Please try again.'));

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    fireEvent.change(screen.getByTestId('mfa-code-input'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    });

    expect(screen.getByTestId('mfa-code-error')).toHaveTextContent(
      'Invalid code. Please try again.'
    );
  });

  it('resends the email OTP from the challenge panel', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['otp-email'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    mockRequestEmailOtp.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    });

    expect(mockRequestEmailOtp).toHaveBeenCalledTimes(1);
  });

  it('surfaces resend failures as a toast', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['otp-email'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    mockRequestEmailOtp.mockRejectedValueOnce(new Error('resend down'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'resend down' })
    );
  });

  it('cancels the challenge, signs out, and returns to the form', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    });

    expect(mockSignout).toHaveBeenCalled();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.queryByText('Two-factor authentication')).not.toBeInTheDocument();
  });

  it('swallows signout failures when cancelling the challenge', async () => {
    mockSignIn.mockResolvedValue({ status: 'MFA_REQUIRED', factors: ['totp'] });
    mockSignout.mockRejectedValue(new Error('signout down'));

    render(<SignIn />);
    fillCredentials();
    await submitSignIn();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    });

    expect(screen.getByTestId('email-input')).toBeInTheDocument();
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<SignIn />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
