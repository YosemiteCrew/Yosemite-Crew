import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

jest.mock('@/app/ui/layout/guards/DevRouteGuard/DevRouteGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dev-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  __esModule: true,
  Primary: ({ text, href }: any) => (
    <a href={href} data-testid={`primary-${text}`}>
      {text}
    </a>
  ),
}));

jest.mock('@/app/ui/icons/Icon', () => ({
  __esModule: true,
  Icon: ({ icon }: any) => <span data-testid={`icon-${icon}`} />,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: any) => (
    <span data-testid="species-photo" data-src={src} data-alt={alt} />
  ),
}));

import DeveloperPlugins from '@/app/features/developers/pages/DeveloperPlugins/DeveloperPlugins';

describe('DeveloperPlugins page', () => {
  test('renders the header, preview note and submit action', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Plugins' })).toBeInTheDocument();
    expect(
      screen.getByText(/plugin catalog and submission flow are coming soon/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('primary-Submit a plugin')).toHaveAttribute('href', '/contact-us');
  });

  test('renders three sample cards, every one badged as a sample', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByRole('heading', { name: 'Lab result bridge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clinical reference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monitor sync' })).toBeInTheDocument();
    expect(screen.getAllByText('Sample')).toHaveLength(3);
  });

  test('claims no installs, and names no third party as having one', () => {
    // Nothing counts installs - there is no plugin model and no plugin
    // endpoint - and two of these named real companies.
    render(<DeveloperPlugins />);
    expect(screen.queryByText(/Installed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/412 clinics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,208 clinics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/IDEXX/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MSD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jonas Timm/)).not.toBeInTheDocument();
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  test('says on the page that the cards are illustrations', () => {
    render(<DeveloperPlugins />);
    expect(
      screen.getByText(/cards below are illustrations, not installed integrations/i)
    ).toBeInTheDocument();
  });

  test('renders the website builder promo card linking to the builder route', () => {
    render(<DeveloperPlugins />);
    expect(screen.getByText(/A clinic website with booking built in/i)).toBeInTheDocument();
    const openBuilder = screen.getByText('Open builder').closest('a');
    expect(openBuilder).toHaveAttribute('href', '/developers/website-builder');
    const seeTemplates = screen.getByText('See templates').closest('a');
    expect(seeTemplates).toHaveAttribute('href', '/developers/website-builder');
    expect(screen.getByText('alpenblick.vet')).toBeInTheDocument();
    expect(screen.getByText(/Bookings sync to the PIMS in real time/i)).toBeInTheDocument();
  });

  test('has no axe violations', async () => {
    const { container } = render(<DeveloperPlugins />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('website promo panel reads ink from the fixed --spot-ink/--color-cyan tokens', () => {
  // .dev-website-card is painted from --spot, which stays dark in both themes.
  // Its title/body/ghost-CTA ink must come from --spot-ink (fixed the same way),
  // not the flipping --ink - otherwise light mode collapses to near-1:1 contrast,
  // the exact bug this migration is closing (see PR #2967's DeveloperPortalHome
  // fix for the same pattern).
  const css = readFileSync(
    join(
      process.cwd(),
      'src/app/features/developers/pages/DeveloperPlugins/DeveloperPlugins.css'
    ),
    'utf8'
  );

  it('does not hardcode the promo panel copy as a frozen cream literal', () => {
    expect(css).not.toMatch(/\.dev-website-title\s*{[^}]*color:\s*#f4efe6/);
    expect(css).not.toMatch(/\.dev-website-body\s*{[^}]*color:\s*rgba\(\s*244,\s*239,\s*230/);
    expect(css).not.toMatch(/\.dev-website-cta\.ghost\s*{[^}]*color:\s*#f4efe6/);
  });

  it('routes the promo panel copy through --spot-ink', () => {
    expect(css).toMatch(/\.dev-website-title\s*{[^}]*color:\s*var\(--spot-ink\)/);
    expect(css).toMatch(
      /\.dev-website-body\s*{[^}]*color:\s*color-mix\(in srgb, var\(--spot-ink\) 72%/
    );
    expect(css).toMatch(/\.dev-website-cta\.ghost\s*{[^}]*color:\s*var\(--spot-ink\)/);
  });

  it('keeps the badge tint proportional to --color-cyan instead of a frozen rgba', () => {
    expect(css).not.toMatch(/\.dev-website-badge\s*{[^}]*rgba\(\s*92,\s*225,\s*230/);
    expect(css).toMatch(
      /\.dev-website-badge\s*{[^}]*background:\s*color-mix\(in srgb, var\(--color-cyan\) 14%/
    );
  });
});
