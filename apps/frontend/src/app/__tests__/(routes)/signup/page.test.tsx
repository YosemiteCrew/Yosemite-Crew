import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signup/page';
import { useAuthStore } from '@/app/stores/authStore';
import { redirect } from 'next/navigation';

// Mock the child SignUp component to isolate the page logic
jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => {
  return function MockSignUp() {
    return <div data-testid="mock-signup">SignUp Component</div>;
  };
});

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => null),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

jest.mock('@/app/features/auth/components/PostAuthRedirect', () => ({
  __esModule: true,
  default: ({ fallbackRole }: { fallbackRole?: string | null }) => {
    redirect(fallbackRole === 'owner' ? '/dashboard' : '/');
    return null;
  },
}));

describe('Signup Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => selector({ status: 'idle', role: 'owner' })
    );
  });

  it('renders the SignUp component', async () => {
    await act(async () => {
      render(<Page />);
    });
    expect(screen.getByTestId('mock-signup')).toBeInTheDocument();
  });

  it('redirects users in authenticated state away from signup', async () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) =>
        selector({ status: 'authenticated', role: 'owner' })
    );

    render(<Page />);

    await waitFor(() => {
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
    expect(redirect).not.toHaveBeenCalled();
  });
});
