import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/(routes)/(public)/signup/page';
import { useAuthStore } from '@/app/stores/authStore';
import { useRouter } from 'next/navigation';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

// Mock the child SignUp component to isolate the page logic
jest.mock('@/app/features/auth/pages/SignUp/SignUp', () => {
  return function MockSignUp() {
    return <div data-testid="mock-signup">SignUp Component</div>;
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

describe('Signup Page', () => {
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (useAuthStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => selector({ status: 'idle', role: 'owner' })
    );
    (resolvePostAuthRedirect as jest.Mock).mockResolvedValue('/dashboard');
  });

  it('renders the SignUp component', () => {
    render(<Page />);
    expect(screen.getByTestId('mock-signup')).toBeInTheDocument();
  });

  it('redirects users in signin-authenticated state away from signup', async () => {
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
