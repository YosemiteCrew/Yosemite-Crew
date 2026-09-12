import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

const showErrorTostMock = jest.fn();
let turnstileOptions: Record<string, unknown> | undefined;
const turnstileRenderMock = jest.fn((_container: HTMLElement, options: Record<string, unknown>) => {
  turnstileOptions = options;
  return 'widget-1';
});
const turnstileResetMock = jest.fn();
const turnstileRemoveMock = jest.fn();
let appTheme: 'light' | 'dark' = 'light';

jest.mock('@/app/ui/theme', () => ({
  useTheme: () => ({ theme: appTheme }),
}));

jest.mock('next/script', () => ({
  __esModule: true,
  default: ({ onReady, onError }: { onReady: () => void; onError: () => void }) => (
    <>
      <button type="button" onClick={onReady}>
        Load bot check
      </button>
      <button type="button" onClick={onError}>
        Fail bot check script
      </button>
    </>
  ),
}));
jest.mock('@/app/ui/overlays/Toast/Toast', () => ({
  useErrorTost: () => ({
    showErrorTost: showErrorTostMock,
    ErrorTostPopup: <div data-testid="toast" />,
  }),
}));

const authStoreMock: any = {
  signUp: jest.fn(),
};
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => authStoreMock,
}));

// Mock the shared marketing foundation so its GitHub-stats hook / next/image
// assets don't run in jsdom, while still rendering the form children.
jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  GITHUB_REPO_URL: 'https://github.com/YosemiteCrew/Yosemite-Crew',
  AuthBrandContent: (props: any) => <div data-testid="auth-brand" data-eyebrow={props.eyebrow} />,
  AuthShell: ({ brand, topRight, children }: any) => (
    <div data-testid="auth-shell">
      <div>{brand}</div>
      <div>{topRight}</div>
      <main>{children}</main>
    </div>
  ),
}));

let latestOtpModalProps: any;
jest.mock('@/app/ui/overlays/OtpModal/OtpModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestOtpModalProps = props;
    return <div data-testid="otp-modal" />;
  },
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label, testId }: any) => <div data-testid={testId}>{label}</div>,
}));

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';

expect.extend(toHaveNoViolations);

describe('SignUp page', () => {
  beforeEach(() => {
    authStoreMock.signUp.mockReset();
    showErrorTostMock.mockReset();
    latestOtpModalProps = undefined;
    turnstileOptions = undefined;
    turnstileRenderMock.mockClear();
    turnstileResetMock.mockClear();
    turnstileRemoveMock.mockClear();
    appTheme = 'light';
    (globalThis.window as Window & { turnstile?: unknown }).turnstile = {
      render: turnstileRenderMock,
      reset: turnstileResetMock,
      remove: turnstileRemoveMock,
    };
  });

  const setFieldValue = (label: string, value: string) => {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value },
    });
  };

  const checkTermsBox = () => {
    const termsCheckbox = screen.getByRole('checkbox', {
      name: /terms and conditions/i,
    });
    if (!(termsCheckbox as HTMLInputElement).checked) {
      fireEvent.click(termsCheckbox);
    }
  };

  const getSubmitBtn = () => screen.getByRole('button', { name: /create account/i });

  const fillValidForm = () => {
    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Secret!23');
    setFieldValue('Confirm password', 'Secret!23');
    checkTermsBox();
  };

  test('validates inputs before submitting', () => {
    render(<SignUp />);
    fireEvent.click(getSubmitBtn());
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByText('Confirm Password is required')).toBeInTheDocument();
    expect(screen.getByText('Please check the Terms and Conditions box')).toBeInTheDocument();
  });

  test('shows a visible focus ring on the terms box while the checkbox is focused', () => {
    render(<SignUp />);
    const checkbox = screen.getByRole('checkbox', { name: /terms and conditions/i });
    // The visible custom box is the aria-hidden span immediately before the input.
    const box = checkbox.previousElementSibling as HTMLElement;

    expect(box.style.outlineOffset).toBe('');
    fireEvent.focus(checkbox);
    expect(box.style.outlineOffset).toBe('2px');
    fireEvent.blur(checkbox);
    expect(box.style.outlineOffset).toBe('');
  });

  test('clears first and last name errors as the user updates those fields', () => {
    render(<SignUp />);

    fireEvent.click(getSubmitBtn());
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');

    expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Last name is required')).not.toBeInTheDocument();
  });

  test('blocks signup when the email format is invalid', () => {
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'not-an-email');
    setFieldValue('Set up password', 'Secret!23');
    setFieldValue('Confirm password', 'Secret!23');
    checkTermsBox();
    fireEvent.click(getSubmitBtn());

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
  });

  test('submits signup data and opens verification modal without newsletter opt-in', async () => {
    authStoreMock.signUp.mockResolvedValue({ userId: 'user-1', email: 'jane@example.com' });
    render(<SignUp />);

    fillValidForm();
    fireEvent.click(getSubmitBtn());
    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'jane@example.com',
        'Secret!23',
        'Jane',
        'Doe'
      )
    );
  });

  test('passes the developer role when "A developer" is selected', async () => {
    authStoreMock.signUp.mockResolvedValue({ userId: 'user-1', email: 'jane@example.com' });
    render(<SignUp />);

    await userEvent.click(screen.getByRole('button', { name: /I am/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByText('A developer'));
    fillValidForm();
    fireEvent.click(getSubmitBtn());

    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'jane@example.com',
        'Secret!23',
        'Jane',
        'Doe',
        'developer'
      )
    );
  });

  test('developer variant hides the role selector and passes the developer role', async () => {
    authStoreMock.signUp.mockResolvedValue({ userId: 'user-1', email: 'jane@example.com' });
    render(<SignUp isDeveloper />);

    expect(screen.queryByLabelText('I am')).not.toBeInTheDocument();

    fillValidForm();
    fireEvent.click(getSubmitBtn());

    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'jane@example.com',
        'Secret!23',
        'Jane',
        'Doe',
        'developer'
      )
    );
  });

  test('shows a loader while signup is pending', async () => {
    let resolveSignUp: (() => void) | undefined;
    authStoreMock.signUp.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignUp = () => resolve(true);
        })
    );

    render(<SignUp />);

    fillValidForm();
    fireEvent.click(getSubmitBtn());

    expect(screen.getByTestId('signup-loader')).toHaveTextContent('Creating your account...');
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();

    await waitFor(() => {
      resolveSignUp?.();
      expect(authStoreMock.signUp).toHaveBeenCalled();
    });
  });

  test('surfaces toast error when Cognito returns UsernameExistsException', async () => {
    authStoreMock.signUp.mockRejectedValue({
      code: 'UsernameExistsException',
      message: 'Already exists',
    });
    render(<SignUp />);

    fillValidForm();
    fireEvent.click(getSubmitBtn());
    await waitFor(() => expect(showErrorTostMock).toHaveBeenCalled());
    expect(latestOtpModalProps?.showVerifyModal).toBeFalsy();
  });

  test('requires a completed bot check before signup and sends its token', async () => {
    authStoreMock.signUp.mockResolvedValue({
      userId: 'user-1',
      email: 'janedoe@gmail.com',
    });
    render(<SignUp turnstileSiteKey="site-key" />);
    fillValidForm();
    setFieldValue('Work email', 'Jane.Doe+signup@gmail.com');

    fireEvent.click(getSubmitBtn());
    expect(screen.getByText('Complete bot verification before creating an account.')).toBeVisible();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));
    expect(turnstileRenderMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        sitekey: 'site-key',
        action: 'business_signup',
        size: 'flexible',
      })
    );
    act(() => {
      (turnstileOptions?.callback as (token: string) => void)('verified-token');
    });
    fireEvent.click(getSubmitBtn());

    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'Jane.Doe+signup@gmail.com',
        'Secret!23',
        'Jane',
        'Doe',
        undefined,
        'verified-token'
      )
    );
    expect(latestOtpModalProps).toEqual(
      expect.objectContaining({
        email: 'janedoe@gmail.com',
        showVerifyModal: true,
      })
    );
  });

  test('resets the single-use bot token after a rejected signup', async () => {
    authStoreMock.signUp.mockRejectedValue(new Error('Already registered'));
    render(<SignUp turnstileSiteKey="site-key" />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));
    act(() => {
      (turnstileOptions?.callback as (token: string) => void)('single-use-token');
    });

    fireEvent.click(getSubmitBtn());

    await waitFor(() => expect(turnstileResetMock).toHaveBeenCalledWith('widget-1'));

    fireEvent.click(getSubmitBtn());
    await waitFor(() => {
      expect(authStoreMock.signUp).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('Complete bot verification before creating an account.')
      ).toBeVisible();
    });
  });

  test('clears an expired bot token before signup', () => {
    render(<SignUp turnstileSiteKey="site-key" />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));
    act(() => {
      (turnstileOptions?.callback as (token: string) => void)('single-use-token');
      (turnstileOptions?.['expired-callback'] as () => void)();
    });

    fireEvent.click(getSubmitBtn());

    expect(authStoreMock.signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Complete bot verification before creating an account.')).toBeVisible();
  });

  test.each(['error-callback', 'unsupported-callback'] as const)(
    'shows an unavailable message after the Turnstile %s',
    (callbackName) => {
      render(<SignUp turnstileSiteKey="site-key" />);
      fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));

      let callbackResult: unknown;
      act(() => {
        callbackResult = (turnstileOptions?.[callbackName] as () => unknown)();
      });

      expect(
        screen.getByText('Bot verification is unavailable. Please try again later.')
      ).toBeVisible();
      if (callbackName === 'error-callback') expect(callbackResult).toBe(true);
    }
  );

  test('shows an unavailable message when the Turnstile script fails to load', () => {
    render(<SignUp turnstileSiteKey="site-key" />);

    fireEvent.click(screen.getByRole('button', { name: 'Fail bot check script' }));

    expect(
      screen.getByText('Bot verification is unavailable. Please try again later.')
    ).toBeVisible();
  });

  test('removes the Turnstile widget when signup unmounts', () => {
    const { unmount } = render(<SignUp turnstileSiteKey="site-key" />);
    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));

    unmount();

    expect(turnstileRemoveMock).toHaveBeenCalledWith('widget-1');
  });

  test('rerenders the Turnstile widget when the app theme changes', () => {
    const { rerender } = render(<SignUp turnstileSiteKey="site-key" />);
    fireEvent.click(screen.getByRole('button', { name: 'Load bot check' }));

    expect(turnstileRenderMock).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ theme: 'light' })
    );

    appTheme = 'dark';
    rerender(<SignUp turnstileSiteKey="site-key" />);

    expect(turnstileRemoveMock).toHaveBeenCalledWith('widget-1');
    expect(turnstileRenderMock).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ theme: 'dark' })
    );
  });

  test('blocks production signup when the Turnstile site key is missing', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    render(<SignUp />);

    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    expect(
      screen.getByText('Bot verification is unavailable. Please try again later.')
    ).toBeVisible();
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<SignUp />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('shows a live password strength readout that improves as the password does', () => {
    render(<SignUp />);
    expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();

    setFieldValue('Set up password', 'short');
    expect(screen.getByText('Password strength: Too weak')).toBeInTheDocument();

    setFieldValue('Set up password', 'Okay now 1!');
    expect(screen.getByText('Password strength: Strong')).toBeInTheDocument();
  });

  test('does not show a strength readout on the confirm-password field', () => {
    render(<SignUp />);
    setFieldValue('Confirm password', 'Okay now 1!');
    expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();
  });
});

describe('auth-brand headline reads the fixed accent-dark token', () => {
  // AuthShell's brand panel is painted with a literal, permanently-dark
  // gradient (never a token), so the "whole" emphasis must stay pinned to a
  // fixed-dark-tuned ink rather than the flipping --blue-text - otherwise
  // light mode would put --blue-text's near-black light value on the
  // permanently-dark hero.
  const source = readFileSync(
    join(process.cwd(), 'src/app/features/auth/pages/SignUp/SignUp.tsx'),
    'utf8'
  );

  it('does not hardcode the emphasis colour as a frozen literal', () => {
    expect(source).not.toContain("color: '#8fb6f5'");
  });

  it('routes the emphasis colour through --color-accent-dark', () => {
    expect(source).toContain("color: 'var(--color-accent-dark)'");
  });
});
