import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IoCalendarOutline } from 'react-icons/io5';

let starsValue: string | null = '2.4k';
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

import { AuthShell, AuthBrandContent } from '@/app/features/marketing/site/AuthShell';

describe('AuthBrandContent', () => {
  beforeEach(() => {
    starsValue = '2.4k';
  });

  it('renders eyebrow, title, subtitle, points and the live star count', () => {
    render(
      <AuthBrandContent
        eyebrow="Open-source operating system for animal health"
        title={<>See the whole animal.</>}
        subtitle="The operating system veterinary clinics run on."
        points={[
          { icon: <IoCalendarOutline aria-hidden="true" />, text: 'Appointments on one screen.' },
        ]}
      />
    );
    expect(screen.getByText('Open-source operating system for animal health')).toBeInTheDocument();
    expect(screen.getByText('Appointments on one screen.')).toBeInTheDocument();
    expect(screen.getByText(/Star on GitHub · 2\.4k/)).toBeInTheDocument();
  });

  it('shows the plain GitHub label when the star count is unresolved', () => {
    starsValue = null;
    render(<AuthBrandContent eyebrow="e" title="t" subtitle="s" points={[]} />);
    expect(screen.getByText('Star on GitHub')).toBeInTheDocument();
  });

  it('colors the title and GitHub pill from --spot-ink, not hardcoded hex', () => {
    render(<AuthBrandContent eyebrow="e" title="See the whole animal." subtitle="s" points={[]} />);
    expect(screen.getByText('See the whole animal.')).toHaveStyle({ color: 'var(--spot-ink)' });
    expect(screen.getByRole('link', { name: /Star on GitHub/i })).toHaveStyle({
      color: 'var(--spot-ink)',
    });
  });
});

describe('AuthShell', () => {
  it('renders the brand panel, switch prompt, cert badges and the main form region', () => {
    render(
      <AuthShell
        brand={<div data-testid="brand-slot" />}
        topRight={<span>Already have an account?</span>}
      >
        <form aria-label="signup-form" />
      </AuthShell>
    );
    expect(screen.getByTestId('brand-slot')).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to home/i })).toBeInTheDocument();
    expect(screen.getByAltText('GDPR')).toBeInTheDocument();
    expect(screen.getByAltText('SOC 2')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('form', { name: 'signup-form' })).toBeInTheDocument();
  });

  it('colors the brand panel ink from --spot-ink, not hardcoded hex', () => {
    const { container } = render(
      <AuthShell brand={<div />} topRight={<span />}>
        <form aria-label="signup-form" />
      </AuthShell>
    );
    expect(container.querySelector('[data-brandpanel="true"]')).toHaveStyle({
      color: 'var(--spot-ink)',
    });
  });
});

describe('brand panel reads ink and glow colours from real tokens', () => {
  // BRAND_PANEL_STYLE is painted from a fixed near-black gradient, never
  // themed, so everything on it must read a token that either never flips
  // (--spot-ink, --blue, --color-cyan, --pink, --color-accent-dark) rather
  // than a hardcoded copy of one theme's resolved value.
  const source = readFileSync(
    join(process.cwd(), 'src/app/features/marketing/site/AuthShell.tsx'),
    'utf8'
  );

  it('does not hardcode the point-icon ink as a frozen light-mode literal', () => {
    expect(source).not.toContain("color: '#8fb6f5'");
  });

  it('routes the point-icon ink through --color-accent-dark', () => {
    expect(source).toContain("color: 'var(--color-accent-dark)'");
  });

  it('does not hardcode the spot-ink tints as frozen rgba literals', () => {
    expect(source).not.toMatch(/rgba\(234,\s*226,\s*213/);
  });

  it('routes the spot-ink tints through color-mix', () => {
    expect(source).toMatch(/color-mix\(in srgb, var\(--spot-ink\) 10%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--spot-ink\) 16%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--spot-ink\) 18%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--spot-ink\) 5%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--spot-ink\) 22%, transparent\)/);
  });

  it('does not hardcode the ambient glows as frozen rgba literals', () => {
    expect(source).not.toContain('rgba(37,123,237,0.26)');
    expect(source).not.toContain('rgba(92,225,230,0.14)');
    expect(source).not.toContain('rgba(255,144,212,0.10)');
  });

  it('routes the ambient glows through --blue, --color-cyan and --pink', () => {
    expect(source).toMatch(/color-mix\(in srgb, var\(--blue\) 26%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--color-cyan\) 14%, transparent\)/);
    expect(source).toMatch(/color-mix\(in srgb, var\(--pink\) 10%, transparent\)/);
  });
});
