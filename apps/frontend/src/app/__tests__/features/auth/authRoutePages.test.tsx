import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/features/auth/pages/AuthedRedirectShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));
jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => ({
  __esModule: true,
  default: () => <div>Sign in screen</div>,
}));
jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => ({
  __esModule: true,
  default: () => <div>Sign up screen</div>,
}));

import SignInPage from '@/app/features/auth/pages/SignIn/SignInPage';
import SignUpPage from '@/app/features/auth/pages/SignUp/SignUpPage';

describe('auth route pages', () => {
  it('SignInPage renders the sign-in screen inside the redirect shell', () => {
    render(<SignInPage />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByText('Sign in screen')).toBeInTheDocument();
  });

  it('SignUpPage renders the sign-up screen inside the redirect shell', () => {
    render(<SignUpPage />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByText('Sign up screen')).toBeInTheDocument();
  });
});
