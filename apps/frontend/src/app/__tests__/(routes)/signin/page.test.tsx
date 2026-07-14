import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signin/page';
import { useAuthStore } from '@/app/stores/authStore';
import { redirect } from 'next/navigation';

jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => {
  return function MockSignIn() {
    return <div data-testid="mock-signin">SignIn Component</div>;
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

describe('Signin Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => selector({ status: 'idle', role: 'owner' })
    );
  });

  it('renders the SignIn component', async () => {
    await act(async () => {
      render(<Page />);
    });
    expect(screen.getByTestId('mock-signin')).toBeInTheDocument();
  });

  it('redirects users in authenticated state away from signin', async () => {
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
      expect(screen.getByTestId('mock-signin')).toBeInTheDocument();
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
