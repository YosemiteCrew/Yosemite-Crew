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
  default: ({ turnstileSiteKey }: { turnstileSiteKey?: string }) => (
    <div data-testid="signup-mock" data-turnstile-site-key={turnstileSiteKey ?? ''}>
      Sign up screen
    </div>
  ),
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

  it('SignUpPage passes no turnstileSiteKey by default, as the real /signup route renders it', () => {
    render(<SignUpPage />);
    expect(screen.getByTestId('signup-mock')).toHaveAttribute('data-turnstile-site-key', '');
  });

  it('SignUpPage threads an explicit turnstileSiteKey through to SignUp (Storybook-only)', () => {
    render(<SignUpPage turnstileSiteKey="storybook-test-site-key" />);
    expect(screen.getByTestId('signup-mock')).toHaveAttribute(
      'data-turnstile-site-key',
      'storybook-test-site-key'
    );
  });
});
