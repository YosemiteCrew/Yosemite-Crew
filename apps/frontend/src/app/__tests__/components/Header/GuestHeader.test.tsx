import '../../../jest.mocks/testMocks';

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPathname = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuthStore = jest.fn();
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/app/ui/layout/Header/MobileMenu', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mobile-menu">{children}</div>
  ),
}));

import GuestHeader from '@/app/ui/layout/Header/GuestHeader/GuestHeader';

describe('GuestHeader', () => {
  beforeEach(() => {
    mockPush.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('shows CTA based on auth state', () => {
    mockPathname.mockReturnValue('/pricing');
    mockUseAuthStore.mockReturnValue({ user: { id: '123' } });

    render(<GuestHeader />);

    const ctas = screen.getAllByTestId('primary-btn');
    expect(ctas[0]).toHaveTextContent('Go to app');
    expect(ctas[0]).toHaveAttribute('href', '/appointments');
  });

  test('shows Sign up CTA on signin page for unauthenticated users', () => {
    mockPathname.mockReturnValue('/signin');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);
    const mobileMenu = screen.getByTestId('mobile-menu');
    const cta = within(mobileMenu).getByTestId('primary-btn');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('Sign up');
    expect(cta).toHaveAttribute('href', '/signup');
  });

  test('shows Sign in CTA on signup page for unauthenticated users', () => {
    mockPathname.mockReturnValue('/signup');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);
    const mobileMenu = screen.getByTestId('mobile-menu');
    const cta = within(mobileMenu).getByTestId('primary-btn');
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('Sign in');
    expect(cta).toHaveAttribute('href', '/signin');
  });

  test('hides CTA on organizations page', () => {
    mockPathname.mockReturnValue('/organizations');
    mockUseAuthStore.mockReturnValue({ user: { id: '123' } });

    render(<GuestHeader />);
    expect(screen.queryByTestId('primary-btn')).not.toBeInTheDocument();
  });

  test('uses a real route for the mobile developer CTA', () => {
    mockPathname.mockReturnValue('/developers');
    mockUseAuthStore.mockReturnValue({
      status: 'authenticated',
      user: { id: '123' },
      role: 'developer',
    });

    render(<GuestHeader />);

    const mobileMenu = screen.getByTestId('mobile-menu');
    const mobileCta = within(mobileMenu).getByRole('link', { name: /go to app/i });

    expect(mobileCta).toHaveAttribute('href', '/developers/home');

    fireEvent.click(mobileCta);
    jest.advanceTimersByTime(400);

    expect(mockPush).toHaveBeenCalledWith('/developers/home');
  });

  test('uses real routes for the mobile sign up and sign in CTAs', () => {
    mockPathname.mockReturnValue('/signin');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);

    const mobileMenu = screen.getByTestId('mobile-menu');
    const signUpCta = within(mobileMenu).getByRole('link', { name: /sign up/i });

    expect(signUpCta).toHaveAttribute('href', '/signup');
  });
});
