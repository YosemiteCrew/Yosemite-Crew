import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SignIn from '@/app/features/auth/pages/SignIn/SignIn';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useErrorTost } from '@/app/ui/overlays/Toast/Toast';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

// --- Mocks ---

// Mock Next.js Navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock Auth Store
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// Mock Toast
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
  sanitizeNextPath: jest.fn((value: string | null) => {
    if (!value) return undefined;
    if (!value.startsWith('/')) return undefined;
    return value;
  }),
}));

// Mock the shared marketing foundation (AuthShell / AuthBrandContent) so its
// GitHub-stats hook and next/image assets don't hit the network in jsdom.
jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
  AuthBrandContent: () => <div data-testid="auth-brand" />,
  AuthShell: ({ brand, topRight, children }: any) => (
    <div data-testid="auth-shell">
      <div>{brand}</div>
      <div>{topRight}</div>
      <main>{children}</main>
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/OtpModal/OtpModal', () => ({
  __esModule: true,
  default: ({ showVerifyModal }: any) =>
    showVerifyModal ? <div data-testid="otp-modal">OTP Modal Open</div> : null,
}));

// Render the GitHub button as an identifiable stub so its conditional presence
// (developer account type only) is assertable without the env gate.
jest.mock('@/app/features/auth/pages/GithubSignInButton', () => ({
  GithubSignInButton: ({ note }: any) => <div data-testid="github-signin">{note}</div>,
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

const getEmailInput = () => screen.getByRole('textbox', { name: /email/i });
const getPasswordInput = () => screen.getByLabelText('Password');
const getSubmitBtn = () => screen.getByRole('button', { name: /sign in/i });

describe('SignIn Page', () => {
  const mockSignIn = jest.fn();
  const mockResendCode = jest.fn();
  const mockRouterPush = jest.fn();
  const mockRouterReplace = jest.fn();
  const mockShowErrorTost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      resendCode: mockResendCode,
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: mockRouterPush,
      replace: mockRouterReplace,
    });

    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());

    (useErrorTost as jest.Mock).mockReturnValue({
      showErrorTost: mockShowErrorTost,
      ErrorTostPopup: <div data-testid="toast-popup" />,
    });

    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/create-org');
  });

  /* The store mock is a bare jest.fn() with no getState. Tests that need one
     assign it, and it would otherwise persist onto the shared mock for every
     later test - changing the fallbackRole they observe. clearAllMocks does not
     remove an added property, so remove it here. */
  afterEach(() => {
    delete (useAuthStore as unknown as { getState?: unknown }).getState;
  });

  // --- 1. Rendering ---

  it('renders the sign-in form correctly (default mode)', () => {
    render(<SignIn />);

    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(getSubmitBtn()).toBeInTheDocument();
    // The show-password toggle must exist for e2e.
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
  });

  it('renders correctly in developer mode', () => {
    render(<SignIn isDeveloper={true} signupHref="/dev-signup" />);

    expect(screen.getByText('Sign in to your developer account')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/dev-signup');
  });

  // --- Account-type selector (pet business vs developer) ---

  it('defaults to the pet business account type and hides the GitHub option', () => {
    render(<SignIn />);

    expect(screen.getByRole('radio', { name: 'Pet business' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: 'Developer' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.queryByTestId('github-signin')).not.toBeInTheDocument();
  });

  it('reveals the GitHub option and developer heading when the developer type is selected', () => {
    render(<SignIn />);
    expect(screen.queryByTestId('github-signin')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Developer' }));

    expect(screen.getByRole('radio', { name: 'Developer' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('github-signin')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your developer account')).toBeInTheDocument();

    // Switching back to pet business hides the GitHub option again.
    fireEvent.click(screen.getByRole('radio', { name: 'Pet business' }));
    expect(screen.queryByTestId('github-signin')).not.toBeInTheDocument();
  });

  it('signs in as a developer when that account type is selected', async () => {
    mockSignIn.mockResolvedValue({});
    render(<SignIn />);

    fireEvent.click(screen.getByRole('radio', { name: 'Developer' }));
    fireEvent.change(getEmailInput(), { target: { value: 'dev@example.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'pass123' } });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    /* The developer form no longer forces a developer destination - the role
       does. Passing the form flag routed non-developers to /developers/home,
       where the guard rejected them. */
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith(
      expect.not.objectContaining({ isDeveloper: expect.anything() })
    );
  });

  it('tells a non-developer why the developer portal is not opening', async () => {
    mockSignIn.mockResolvedValue({});
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      resendCode: mockResendCode,
      role: 'user',
    });
    (useAuthStore as unknown as { getState: unknown }).getState = () => ({ role: 'user' });

    render(<SignIn isDeveloper />);
    fireEvent.change(getEmailInput(), { target: { value: 'clinic@example.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'pass123' } });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    /* The sign-in itself succeeded - the account just is not a developer one.
       Saying nothing here is what made this read as a rejected password. */
    expect(mockSignIn).toHaveBeenCalled();
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ errortext: 'Not a developer account' })
    );
  });

  it('stays quiet when the signed-in account really is a developer', async () => {
    mockSignIn.mockResolvedValue({});
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      signIn: mockSignIn,
      resendCode: mockResendCode,
      role: 'developer',
    });
    (useAuthStore as unknown as { getState: unknown }).getState = () => ({ role: 'developer' });

    render(<SignIn isDeveloper />);
    fireEvent.change(getEmailInput(), { target: { value: 'dev@example.com' } });
    fireEvent.change(getPasswordInput(), { target: { value: 'pass123' } });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockShowErrorTost).not.toHaveBeenCalled();
  });

  it('toggles password visibility with the show-password button', () => {
    render(<SignIn />);

    const passInput = getPasswordInput();
    expect(passInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passInput).toHaveAttribute('type', 'text');
  });

  // --- 2. Input & Validation ---

  it('updates state on input change', () => {
    render(<SignIn />);

    const emailInput = getEmailInput();
    const passInput = getPasswordInput();

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passInput, { target: { value: 'password123' } });

    expect(emailInput).toHaveValue('test@example.com');
    expect(passInput).toHaveValue('password123');
  });

  it('shows validation errors when fields are empty', () => {
    render(<SignIn />);

    fireEvent.click(getSubmitBtn());

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('clears the password validation error when the user edits the password field', () => {
    render(<SignIn />);

    fireEvent.click(getSubmitBtn());
    expect(screen.getByText('Password is required')).toBeInTheDocument();

    fireEvent.change(getPasswordInput(), {
      target: { value: 'updated-password' },
    });

    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
  });

  it('shows a validation error for an invalid email format', () => {
    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'password123' },
    });
    fireEvent.click(getSubmitBtn());

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  // --- 3. Success Flow ---

  it('calls signIn and redirects on success', async () => {
    mockSignIn.mockResolvedValue({}); // Success

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'pass123');
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith({
      fallbackRole: undefined,
      redirectPath: undefined,
    });
    expect(mockRouterReplace).toHaveBeenCalledWith('/create-org');
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('devAuth', 'false');
  });

  it('sets devAuth to true in storage when isDeveloper is true', async () => {
    mockSignIn.mockResolvedValue({});

    render(<SignIn isDeveloper={true} />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'dev@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('devAuth', 'true');
    expect(resolvePostAuthRedirect).toHaveBeenCalledWith({
      fallbackRole: undefined,
      redirectPath: undefined,
    });
  });

  it('shows a loader while the sign-in request is pending', async () => {
    let resolveSignIn: (() => void) | undefined;
    mockSignIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = () => resolve({});
        })
    );

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    // Capture the button before submit: while pending its label becomes
    // "Signing in..." so it no longer matches the /sign in/i accessible name.
    const submitBtn = getSubmitBtn();
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByTestId('signin-loader')).toHaveTextContent('Signing you in...');
    expect(submitBtn).toBeDisabled();

    await act(async () => {
      resolveSignIn?.();
    });
  });

  // --- 4. Error Handling & Edge Cases ---

  it('handles generic sign-in error', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid credentials'));

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid credentials',
        errortext: 'Error',
      })
    );
  });

  it('handles UserNotConfirmedException by resending code and showing modal', async () => {
    const error = { code: 'UserNotConfirmedException' };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockResolvedValue(true);

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'unconfirmed@test.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockResendCode).toHaveBeenCalledWith('unconfirmed@test.com');
    // Wait for state update to show modal (OtpModal mock renders based on showVerifyModal prop)
    expect(screen.getByTestId('otp-modal')).toBeInTheDocument();
  });

  it('handles error during resend code (UserNotConfirmed flow)', async () => {
    const error = { code: 'UserNotConfirmedException' };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockRejectedValue(new Error('Resend failed'));

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 'unconfirmed@test.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockResendCode).toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resend failed',
      })
    );
    // Modal should not open on resend failure
    expect(screen.queryByTestId('otp-modal')).not.toBeInTheDocument();
  });

  it('uses default error message if error object has no message', async () => {
    mockSignIn.mockRejectedValue({}); // No message

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 't@t.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'p' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sign in failed' })
    );
  });

  it('uses default error message for resend failure', async () => {
    const error = { code: 'UserNotConfirmedException' };
    mockSignIn.mockRejectedValue(error);
    mockResendCode.mockRejectedValue({}); // No message

    render(<SignIn />);

    fireEvent.change(getEmailInput(), {
      target: { value: 't@t.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'p' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(mockShowErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error resending code.' })
    );
  });

  it('prefills the email field from the email query param', () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({ email: 'new-user@example.com' })
    );

    render(<SignIn />);

    expect(getEmailInput()).toHaveValue('new-user@example.com');
  });

  it('renders with an empty email when useSearchParams returns null', () => {
    (useSearchParams as jest.Mock).mockReturnValue(null);

    render(<SignIn />);

    expect(getEmailInput()).toHaveValue('');
  });

  it('honors a safe next query param as the post-auth redirect', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams({ next: '/create-org' }));
    mockSignIn.mockResolvedValue({});

    render(<SignIn />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(resolvePostAuthRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectPath: '/create-org' })
    );
  });

  it('ignores unsafe or external next values', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({ next: 'https://evil.example.com/phish' })
    );
    mockSignIn.mockResolvedValue({});

    render(<SignIn />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(resolvePostAuthRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectPath: undefined })
    );
  });

  it('ignores next when allowNext is false', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams({ next: '/create-org' }));
    mockSignIn.mockResolvedValue({});

    render(<SignIn allowNext={false} redirectPath="/developers/home" isDeveloper />);
    fireEvent.change(getEmailInput(), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(getSubmitBtn());
    });

    expect(resolvePostAuthRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectPath: '/developers/home' })
    );
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<SignIn />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
