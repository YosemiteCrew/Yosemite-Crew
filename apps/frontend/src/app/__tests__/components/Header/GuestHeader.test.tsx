import '../../../jest.mocks/testMocks';

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

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

import GuestHeader from '@/app/ui/layout/Header/GuestHeader/GuestHeader';

expect.extend(toHaveNoViolations);

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

    expect(
      screen
        .getAllByRole('link', { name: 'Go to app' })
        .some((link) => link.getAttribute('href') === '/appointments')
    ).toBe(true);
  });

  test('shows Sign up CTA on signin page for unauthenticated users', () => {
    mockPathname.mockReturnValue('/signin');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);
    expect(
      screen
        .getAllByRole('link', { name: 'Sign up' })
        .some((link) => link.getAttribute('href') === '/signup')
    ).toBe(true);
  });

  test('shows Sign in CTA on signup page for unauthenticated users', () => {
    mockPathname.mockReturnValue('/signup');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);
    expect(
      screen
        .getAllByRole('link', { name: 'Sign in' })
        .some((link) => link.getAttribute('href') === '/signin')
    ).toBe(true);
  });

  test('hides CTA on organizations page', () => {
    mockPathname.mockReturnValue('/organizations');
    mockUseAuthStore.mockReturnValue({ user: { id: '123' } });

    render(<GuestHeader />);
    expect(screen.queryByTestId('primary-btn')).not.toBeInTheDocument();
  });

  test('wires the mobile menu button to the mobile navigation drawer', () => {
    mockPathname.mockReturnValue('/pricing');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-controls', 'guest-mobile-menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByLabelText('Mobile navigation')).toHaveAttribute('id', 'guest-mobile-menu');
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  test('closes the mobile menu when Escape is pressed', () => {
    mockPathname.mockReturnValue('/pricing');
    mockUseAuthStore.mockReturnValue({ user: null });

    render(<GuestHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    fireEvent.keyDown(mobileNav, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});

// axe tests run with real timers — axe-core relies on setTimeout internally
describe('GuestHeader — accessibility (axe)', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  test('has no axe accessibility violations when unauthenticated', async () => {
    mockPathname.mockReturnValue('/pricing');
    mockUseAuthStore.mockReturnValue({ user: null });

    const { container } = render(<GuestHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no axe accessibility violations when authenticated', async () => {
    mockPathname.mockReturnValue('/pricing');
    mockUseAuthStore.mockReturnValue({ user: { id: '123' } });

    const { container } = render(<GuestHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
