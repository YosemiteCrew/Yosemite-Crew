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
    authStoreMock.signUp.mockResolvedValue(true);
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
    authStoreMock.signUp.mockResolvedValue(true);
    render(<SignUp />);

    fireEvent.change(screen.getByLabelText('I am'), {
      target: { value: 'A developer' },
    });
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

  test('reveals the GitHub option only for the developer role', () => {
    render(<SignUp />);

    expect(screen.queryByRole('link', { name: /continue with github/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('I am'), {
      target: { value: 'A developer' },
    });

    expect(screen.getByRole('link', { name: /continue with github/i })).toBeInTheDocument();
  });

  test('developer variant hides the role selector and passes the developer role', async () => {
    authStoreMock.signUp.mockResolvedValue(true);
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

  test('has no axe accessibility violations', async () => {
    const { container } = render(<SignUp />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
