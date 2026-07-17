import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: ({ title, options, selected }: any) => (
    <div data-testid="card-header" data-selected={selected} data-options={options.join('|')}>
      {title}
    </div>
  ),
}));

describe('StatCardShell', () => {
  it('renders the title and forwards the options to the card header', () => {
    render(
      <StatCardShell title="Product turnover" options={['Last 1 year', 'Last 6 months']} isEmpty>
        <div>body</div>
      </StatCardShell>
    );

    const header = screen.getByTestId('card-header');
    expect(header).toHaveTextContent('Product turnover');
    expect(header).toHaveAttribute('data-options', 'Last 1 year|Last 6 months');
  });

  it('selects the first option', () => {
    render(
      <StatCardShell title="Any" options={['Last 6 months', 'Last 1 year']} isEmpty={false}>
        <div>body</div>
      </StatCardShell>
    );

    expect(screen.getByTestId('card-header')).toHaveAttribute('data-selected', 'Last 6 months');
  });

  it('renders children and no empty state when isEmpty is false', () => {
    render(
      <StatCardShell title="Any" options={['Last 1 year']} isEmpty={false}>
        <div>real body</div>
      </StatCardShell>
    );

    expect(screen.getByText('real body')).toBeInTheDocument();
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
  });

  it('renders the empty state instead of children when isEmpty is true', () => {
    const { container } = render(
      <StatCardShell title="Any" options={['Last 1 year']} isEmpty>
        <div>real body</div>
      </StatCardShell>
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('real body')).not.toBeInTheDocument();
    // The placeholder bar chart is decorative.
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
  });

  it('wraps the body in the shared card surface', () => {
    const { container } = render(
      <StatCardShell title="Any" options={['Last 1 year']} isEmpty={false}>
        <div>body</div>
      </StatCardShell>
    );

    expect(container.querySelector('.rounded-2xl')).toHaveClass(
      'bg-neutral-0',
      'border',
      'border-card-border',
      'min-h-75'
    );
  });
});
