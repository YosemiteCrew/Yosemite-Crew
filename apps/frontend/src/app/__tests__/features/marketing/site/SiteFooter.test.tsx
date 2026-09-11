import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

let starsValue: string | null = '2,431';
jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: starsValue }),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextImageMock,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: jest.requireActual('@/app/__tests__/support/marketingTestMocks').NextLinkMock,
}));

import { SiteFooter } from '@/app/features/marketing/site/SiteFooter';

describe('SiteFooter', () => {
  beforeEach(() => {
    starsValue = '2,431';
  });

  // The status pill now reflects the live feed. jsdom has no fetch, so it
  // degrades to `unknown` rather than claiming health.
  it('renders the link columns, compliance chips, status pill and store badges', () => {
    render(<SiteFooter />);
    // column headings
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
    // key links
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: 'Contributing' })).toHaveAttribute(
      'href',
      'https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md'
    );
    // compliance chips + status pill + live star count
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('2,431')).toBeInTheDocument();
    // Discord appears as both a social icon and a Community column link
    expect(screen.getAllByRole('link', { name: 'Discord' }).length).toBeGreaterThan(1);
  });

  it('scrolls to top when the back-to-top button is clicked', () => {
    const scrollSpy = jest.spyOn(globalThis.window, 'scrollTo').mockImplementation(() => {});
    render(<SiteFooter />);
    fireEvent.click(screen.getByRole('button', { name: /Back to top/i }));
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it('renders a star glyph fallback when the star count is unresolved', () => {
    starsValue = null;
    render(<SiteFooter />);
    expect(screen.getByText('★')).toBeInTheDocument();
  });
});

describe('the version-stat divider routes its tint through --page, not a frozen literal', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/app/features/marketing/site/SiteFooter.tsx'),
    'utf8'
  );

  it('does not hardcode the borderLeft as a frozen page-background literal', () => {
    expect(source).not.toContain('rgba(239,232,220');
  });

  it('routes it through --page via color-mix', () => {
    expect(source).toContain(
      "borderLeft: '1px solid color-mix(in srgb, var(--page) 22%, transparent)'"
    );
  });
});
