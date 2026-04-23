import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signin/page';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

jest.mock('@/app/features/auth/pages/SignIn/SignIn', () => {
  return function MockSignIn() {
    return <div data-testid="mock-signin">SignIn Component</div>;
  };
});

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/lib/postAuthRedirect', () => ({
  resolvePostAuthRedirect: jest.fn(),
}));

describe('Signin Page', () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => selector({ status: 'idle', role: 'owner' })
    );
    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/dashboard');
  });

  it('renders the SignIn component', () => {
    render(<Page />);
    expect(screen.getByTestId('mock-signin')).toBeInTheDocument();
  });

  it('redirects users in signin-authenticated state away from signin', async () => {
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) =>
        selector({ status: 'signin-authenticated', role: 'owner' })
    );

    render(<Page />);

    await waitFor(() => {
      expect(resolvePostAuthRedirect).toHaveBeenCalledWith({ fallbackRole: 'owner' });
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
