import React from 'react';
import { render, screen } from '@testing-library/react';

import Page, { metadata } from '@/app/(routes)/(public)/insights/page';

jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  MarketingShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-shell">{children}</div>
  ),
}));

jest.mock('@/app/features/marketing/pages/Insights/Insights', () => ({
  __esModule: true,
  Insights: () => <div data-testid="insights-page">Insights</div>,
}));

describe('Insights route', () => {
  it('renders the insights page inside the marketing shell', () => {
    render(<Page />);
    expect(screen.getByTestId('marketing-shell')).toBeInTheDocument();
    expect(screen.getByTestId('insights-page')).toBeInTheDocument();
  });

  it('exports route metadata', () => {
    expect(metadata.title).toContain('Insights');
    expect(metadata.description).toContain('Building in public');
  });
});
