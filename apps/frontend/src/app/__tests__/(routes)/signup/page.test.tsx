import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signup/page';
import { useAuthStore } from '@/app/stores/authStore';
import { redirect } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

// Mock the child SignUp component to isolate the page logic
jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => {
  return function MockSignUp() {
    return <div data-testid="mock-signup">SignUp Component</div>;
  };
});

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => {
  const useAuthStore = jest.fn();
  (useAuthStore as unknown as { getState: unknown }).getState = jest.fn(() => ({
    checkSession: jest.fn(),
  }));
  return { useAuthStore };
});

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

describe('Signup Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => selector({ status: 'idle', role: 'owner' })
    );
    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/dashboard');
  });

  it('renders the SignUp component', () => {
    render(<Page />);
    expect(screen.getByTestId('mock-signup')).toBeInTheDocument();
  });

  it('redirects users in authenticated state away from signup', async () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) =>
        selector({ status: 'authenticated', role: 'owner' })
    );

    render(<Page />);

    await waitFor(() => {
      expect(resolvePostAuthRedirect).toHaveBeenCalledWith({ fallbackRole: 'owner' });
      expect(redirect).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('does not auto-redirect during signin-authenticated transition', async () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) =>
        selector({ status: 'signin-authenticated', role: 'owner' })
    );

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-signup')).toBeInTheDocument();
    });
    expect(resolvePostAuthRedirect).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
