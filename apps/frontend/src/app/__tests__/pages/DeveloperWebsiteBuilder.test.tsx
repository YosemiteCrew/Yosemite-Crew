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

import DeveloperWebsiteBuilder from '@/app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder';

describe('DeveloperWebsiteBuilder page', () => {
  test('renders the header, preview note and open builder action', () => {
    render(<DeveloperWebsiteBuilder />);
    expect(screen.getByTestId('dev-guard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Website builder' })).toBeInTheDocument();
    expect(screen.getByText(/the website builder is coming soon/i)).toBeInTheDocument();
    expect(screen.getByTestId('primary-Open builder')).toBeInTheDocument();
  });

  test('renders the sample templates', () => {
    render(<DeveloperWebsiteBuilder />);
    expect(screen.getByRole('heading', { name: 'Alpine Clinic' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'City Vets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equine Estate' })).toBeInTheDocument();
    expect(screen.getAllByText('Use template').length).toBe(3);
  });

  test('has no axe violations', async () => {
    const { container } = render(<DeveloperWebsiteBuilder />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('promo panel reads ink from the fixed --spot-ink/--color-cyan tokens', () => {
  // .dev-wb-promo is painted from --spot, which stays dark in both themes.
  // Its badge tint, title, body and step markers must come from
  // --spot-ink/--color-cyan (fixed the same way), not the flipping --ink -
  // otherwise light mode collapses toward 1:1 contrast, the same class of
  // bug fixed on DeveloperPortalHome (#2967), DeveloperPlugins (#2974) and
  // DeveloperSettings (#2978).
  const css = readFileSync(
    join(
      process.cwd(),
      'src/app/features/developers/pages/DeveloperWebsiteBuilder/DeveloperWebsiteBuilder.css'
    ),
    'utf8'
  );

  it('does not hardcode the promo panel copy as a frozen cream or cyan literal', () => {
    expect(css).not.toMatch(/\.dev-wb-promo-title\s*{[^}]*color:\s*#f4efe6/);
    expect(css).not.toMatch(/\.dev-wb-promo-body\s*{[^}]*rgba\(\s*244,\s*239,\s*230/);
    expect(css).not.toMatch(/\.dev-wb-step-label\s*{[^}]*color:\s*#f4efe6/);
    expect(css).not.toMatch(/\.dev-wb-badge\s*{[^}]*rgba\(\s*92,\s*225,\s*230/);
    expect(css).not.toMatch(/\.dev-wb-step-num\s*{[^}]*rgba\(\s*92,\s*225,\s*230/);
  });

  it('routes the promo panel copy through --spot-ink and the tints through --color-cyan', () => {
    expect(css).toMatch(/\.dev-wb-promo-title\s*{[^}]*color:\s*var\(--spot-ink\)/);
    expect(css).toMatch(/\.dev-wb-promo-body\s*{[^}]*color-mix\(in srgb, var\(--spot-ink\) 60%/);
    expect(css).toMatch(/\.dev-wb-step-label\s*{[^}]*color:\s*var\(--spot-ink\)/);
    expect(css).toMatch(
      /\.dev-wb-badge\s*{[^}]*background:\s*color-mix\(in srgb, var\(--color-cyan\) 12%/
    );
    expect(css).toMatch(
      /\.dev-wb-step-num\s*{[^}]*background:\s*color-mix\(in srgb, var\(--color-cyan\) 16%/
    );
  });
});
