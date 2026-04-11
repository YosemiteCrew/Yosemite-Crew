import React from 'react';
import { render, screen } from '@testing-library/react';

import Page, { metadata } from '@/app/(routes)/(public)/insights/page';

jest.mock('@/app/features/overview/pages/OverviewPage', () => ({
  __esModule: true,
  default: () => <div data-testid="insights-page">Insights</div>,
}));

describe('Insights route', () => {
  it('renders the overview page', () => {
    render(<Page />);
    expect(screen.getByTestId('insights-page')).toBeInTheDocument();
  });

  it('exports route metadata', () => {
    expect(metadata.title).toContain('Insights');
    expect(metadata.description).toContain('Project health');
  });
});
