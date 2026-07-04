import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/features/marketing/site/SiteNav', () => ({
  SiteNav: ({ active }: { active?: string }) => (
    <nav data-testid="site-nav">{active ?? 'none'}</nav>
  ),
}));
jest.mock('@/app/features/marketing/site/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));
jest.mock('@/app/features/marketing/site/motion', () => ({
  ScrollProgress: () => <div data-testid="scroll-progress" />,
}));

import { MarketingShell } from '@/app/features/marketing/site/MarketingShell';

describe('MarketingShell', () => {
  it('renders nav, the main landmark, children, footer and scroll progress', () => {
    render(
      <MarketingShell active="pricing">
        <p>page content</p>
      </MarketingShell>
    );
    expect(screen.getByTestId('site-nav')).toHaveTextContent('pricing');
    expect(screen.getByTestId('scroll-progress')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toContainElement(screen.getByText('page content'));
    expect(screen.getByTestId('site-footer')).toBeInTheDocument();
  });

  it('omits the footer when hideFooter is set', () => {
    render(
      <MarketingShell hideFooter>
        <p>x</p>
      </MarketingShell>
    );
    expect(screen.getByTestId('site-nav')).toBeInTheDocument();
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument();
  });
});
