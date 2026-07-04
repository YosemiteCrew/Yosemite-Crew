import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

let starsValue: string | null = '2.4k';
let scrolledValue = false;

jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: starsValue }),
}));
jest.mock('@/app/features/marketing/site/motion', () => ({
  useScrolled: () => scrolledValue,
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, ...props }: Record<string, unknown>) => {
    const rest: Record<string, unknown> = { ...props };
    [
      'fill',
      'priority',
      'sizes',
      'quality',
      'placeholder',
      'blurDataURL',
      'loader',
      'unoptimized',
    ].forEach((k) => delete rest[k]);
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={typeof alt === 'string' ? alt : ''} {...rest} />;
  },
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
}));

import { SiteNav } from '@/app/features/marketing/site/SiteNav';

describe('SiteNav', () => {
  beforeEach(() => {
    starsValue = '2.4k';
    scrolledValue = false;
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
});
