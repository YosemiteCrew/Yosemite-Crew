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

let latestOtpModalProps: any;
jest.mock('@/app/ui/overlays/OtpModal/OtpModal', () => ({
  __esModule: true,
  default: (props: any) => {
    latestOtpModalProps = props;
    return <div data-testid="otp-modal" />;
  },
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    error,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
  }) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock('@/app/ui/inputs/FormInputPass/FormInputPass', () => ({
  __esModule: true,
  default: ({
    inlabel,
    value,
    onChange,
    error,
  }: {
    inlabel: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
  }) => (
    <label>
      {inlabel}
      <input type="password" aria-label={inlabel} value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock(
  'react-bootstrap',
  () => {
    const MockContainer = ({ children, ...props }: any) => <div {...props}>{children}</div>;
    const MockForm = ({
      children,
      onSubmit,
    }: {
      children: React.ReactNode;
      onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
    }) => <form onSubmit={onSubmit}>{children}</form>;
    jest.mock('@/app/ui/primitives/Buttons', () => ({
      Primary: ({
        text,
        onClick,
        isDisabled,
      }: {
        text: string;
        onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
        isDisabled?: boolean;
      }) => (
        <button type="button" onClick={(e) => onClick?.(e)} disabled={isDisabled}>
          {text}
        </button>
      ),
    }));
    (MockForm as any).Check = ({
      label,
      onChange,
      ...rest
    }: {
      label: React.ReactNode;
      onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => (
      <label>
        <input
          type="checkbox"
          onChange={(e) => {
            e.persist?.();
            onChange?.(e);
          }}
          {...rest}
        />
        {label}
      </label>
    );
    return {
      Col: MockContainer,
      Row: MockContainer,
      Form: MockForm,
    };
  },
  { virtual: true }
);

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

  test('validates inputs before submitting', () => {
    render(<SignUp />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
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
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
  });

  test('submits signup data and opens verification modal without newsletter opt-in', async () => {
    authStoreMock.signUp.mockResolvedValue({ userId: 'user-1' });
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'jane@example.com',
        'Test-password-3!',
        'Jane',
        'Doe'
      )
    );
    await waitFor(() => expect(latestOtpModalProps?.showVerifyModal).toBe(true));
    expect(latestOtpModalProps?.email).toBe('jane@example.com');
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

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByTestId('signup-loader')).toHaveTextContent('Creating your account...');
    expect(screen.getByRole('button', { name: 'Creating account...' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await waitFor(() => {
      resolveSignUp?.();
      expect(authStoreMock.signUp).toHaveBeenCalled();
    });
  });

  test('surfaces toast error when the email is already registered', async () => {
    authStoreMock.signUp.mockRejectedValue({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'An account with the given email already exists.',
    });
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(showErrorTostMock).toHaveBeenCalled());
    expect(latestOtpModalProps?.showVerifyModal).toBeFalsy();
  });

  test('renders developer copy when isDeveloper is set', () => {
    render(<SignUp isDeveloper signinHref="/developers/signin" />);

    expect(screen.getByText('Sign up for developer access')).toBeInTheDocument();
    expect(screen.getByText('Build, test, and ship apps on Yosemite Crew')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toHaveAttribute('href', '/developers/signin');
  });

  test('passes the developer role to signUp in developer mode', async () => {
    authStoreMock.signUp.mockResolvedValue({ userId: 'user-1' });
    render(<SignUp isDeveloper />);

    setFieldValue('First name', 'Dev');
    setFieldValue('Last name', 'Eloper');
    setFieldValue('Enter email', 'dev@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() =>
      expect(authStoreMock.signUp).toHaveBeenCalledWith(
        'dev@example.com',
        'Test-password-3!',
        'Dev',
        'Eloper',
        'developer'
      )
    );
  });

  test('rejects weak passwords before submitting', () => {
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'weak');
    setFieldValue('Confirm password', 'weak');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(
      screen.getByText(
        'Password must be at least 8 characters long, include uppercase, lowercase, number, and special character'
      )
    ).toBeInTheDocument();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
  });

  test('rejects mismatched password confirmation', () => {
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-4!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
  });

  test('requires the confirm password field when only the password is set', () => {
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByText('Confirm Password is required')).toBeInTheDocument();
    expect(authStoreMock.signUp).not.toHaveBeenCalled();
  });

  test('shows a generic toast when the signup error has no message', async () => {
    authStoreMock.signUp.mockRejectedValue({});
    render(<SignUp />);

    setFieldValue('First name', 'Jane');
    setFieldValue('Last name', 'Doe');
    setFieldValue('Enter email', 'jane@example.com');
    setFieldValue('Set up password', 'Test-password-3!');
    setFieldValue('Confirm password', 'Test-password-3!');
    checkTermsBox();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() =>
      expect(showErrorTostMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Something went wrong.', errortext: 'Signup Error' })
      )
    );
  });

  test('has no axe accessibility violations', async () => {
    const { container } = render(<SignUp />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
