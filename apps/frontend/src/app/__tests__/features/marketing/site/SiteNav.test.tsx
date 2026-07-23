import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

let starsValue: string | null = '2.4k';
let scrolledValue = false;
let mockAuthState: { status: string; user: unknown; role: string | null };
const mockCheckSession = jest.fn();

jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: starsValue }),
}));
jest.mock('@/app/features/marketing/site/motion', () => ({
  useScrolled: () => scrolledValue,
}));
jest.mock('@/app/stores/authStore', () => {
  const useAuthStore = (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState);
  useAuthStore.getState = () => ({ checkSession: mockCheckSession });
  return { useAuthStore };
});
jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextImageMock,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextLinkMock,
}));

import { SiteNav } from '@/app/features/marketing/site/SiteNav';

describe('SiteNav', () => {
  beforeEach(() => {
    starsValue = '2.4k';
    scrolledValue = false;
    mockAuthState = { status: 'unauthenticated', user: null, role: null };
    mockCheckSession.mockReset();
  });

  it('renders the primary nav links, star count and the get-started CTA', () => {
    render(<SiteNav active="developers" />);
    expect(screen.getAllByRole('link', { name: 'Pet Businesses' }).length).toBeGreaterThan(0);
    expect(screen.getByText('★ 2.4k')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Get started' }).length).toBeGreaterThan(0);
    // active item gets aria-current
    const developersLinks = screen.getAllByRole('link', { name: 'Developers' });
    expect(developersLinks.some((el) => el.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('falls back to a bare star glyph when the count is unresolved', () => {
    starsValue = null;
    render(<SiteNav />);
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('opens and closes the mobile menu via the hamburger and Escape', () => {
    // The hamburger is display:none until the mobile media query applies (not in
    // jsdom), so query it with hidden:true; fireEvent still exercises its handlers.
    render(<SiteNav />);
    const toggle = screen.getByLabelText('Open menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByLabelText('Close menu')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(globalThis.window, { key: 'Escape' });
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('closes the menu when a panel link is clicked', () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    // both desktop + panel render the links; clicking the panel link closes the menu
    fireEvent.click(screen.getAllByRole('link', { name: 'Pricing' })[1]);
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
  });

  it('renders the elevated glass state when scrolled', () => {
    scrolledValue = true;
    render(<SiteNav active="about" />);
    expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0);
  });

  it('shows a "Go to app" link to the default route for an authenticated visitor', () => {
    mockAuthState = { status: 'authenticated', user: { userId: 'u1' }, role: 'developer' };
    render(<SiteNav />);
    const goToApp = screen.getAllByRole('link', { name: 'Go to app' });
    expect(goToApp.length).toBeGreaterThan(0);
    expect(goToApp.every((el) => el.getAttribute('href') === '/developers/home')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('shows the "Get started" sign-up link for a guest', () => {
    render(<SiteNav />);
    const getStarted = screen.getAllByRole('link', { name: 'Get started' });
    expect(getStarted.length).toBeGreaterThan(0);
    expect(getStarted.every((el) => el.getAttribute('href') === '/signup')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Go to app' })).not.toBeInTheDocument();
  });

  it('bootstraps the session check when the auth status is idle', () => {
    mockAuthState = { status: 'idle', user: null, role: null };
    render(<SiteNav />);
    expect(mockCheckSession).toHaveBeenCalledTimes(1);
  });
});
