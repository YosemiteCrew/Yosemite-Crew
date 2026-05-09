import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';

// 1. Mock dependencies
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/app/stores/authStore';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock the auth store
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/hooks/useFullscreenLoader', () => ({
  useFullscreenLoader: jest.fn(),
}));

describe('ProtectedRoute Component', () => {
  const mockReplace = jest.fn();
  const mockPathname = '/dashboard/protected';
  const originalAuthGuard = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD;
  const originalTestHostname = process.env.YC_TEST_HOSTNAME;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'false';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = originalAuthGuard;
    process.env.YC_TEST_HOSTNAME = originalTestHostname;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.YC_TEST_HOSTNAME = 'localhost';

    // Setup default router behavior
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue(mockPathname);
  });

  // Scenario 1: Loading/Checking State
  // Covers: `const isChecking = true`, `if (isChecking) return null`, and the early return in `useEffect`.
  it('renders a loader and does not redirect while checking authentication status', () => {
    // Setup: Status is 'checking'
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'checking' })
    );

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );

    expect(useFullscreenLoader).toHaveBeenCalledWith('auth-guard', true);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();

    // Assert: Does NOT redirect yet
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Scenario 2: Unauthenticated State
  // Covers: `!isAuthed` branch in `useEffect` (redirect) and `if (!isAuthed) return null`.
  it('redirects to signin with the return URL when user is unauthenticated', async () => {
    // Setup: Status is 'unauthenticated'
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'unauthenticated' })
    );

    const { container } = render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );

    // Assert: Renders nothing
    expect(container).toBeEmptyDOMElement();

    // Assert: Redirect is triggered with the correct encoded URL
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/signin?next=${encodeURIComponent(mockPathname)}`);
    });
  });

  // Scenario 3: Authenticated State
  // Covers: Happy path where `children` are returned.
  it('renders children when user is authenticated', () => {
    // Setup: Status is 'authenticated'
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'authenticated' })
    );

    render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );

    // Assert: Children are visible
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(useFullscreenLoader).toHaveBeenCalledWith('auth-guard', false);

    // Assert: No redirect happens
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not bypass auth guard on non-local hosts even if the flag is enabled', async () => {
    process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD = 'true';
    process.env.YC_TEST_HOSTNAME = 'dev.yosemitecrew.com';
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ status: 'unauthenticated' })
    );

    const { container } = render(
      <ProtectedRoute>
        <div data-testid="child">Protected Content</div>
      </ProtectedRoute>
    );

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(`/signin?next=${encodeURIComponent(mockPathname)}`);
    });
  });
});
