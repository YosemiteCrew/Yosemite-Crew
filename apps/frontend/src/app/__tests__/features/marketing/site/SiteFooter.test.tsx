import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

let starsValue: string | null = '2,431';
jest.mock('@/app/features/marketing/site/useGithubStats', () => ({
  useGithubStats: () => ({ stars: starsValue }),
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

import { SiteFooter } from '@/app/features/marketing/site/SiteFooter';

describe('SiteFooter', () => {
  beforeEach(() => {
    starsValue = '2,431';
  });

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
    expect(screen.getByText('All systems operational')).toBeInTheDocument();
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
