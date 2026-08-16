import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import StatCardShell from '@/app/ui/widgets/Stats/StatCardShell';

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: ({ title, options, selected, onSelect }: any) => (
    <div data-testid="card-header" data-selected={selected} data-options={options.join('|')}>
      {title}
      <button type="button" onClick={() => onSelect?.(options.at(-1))}>
        pick-last
      </button>
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

  it('forwards an explicit selected option to the header instead of the first one', () => {
    render(
      <StatCardShell
        title="Any"
        options={['Last 6 months', 'Last 1 year']}
        selected="Last 1 year"
        isEmpty={false}
      >
        <div>body</div>
      </StatCardShell>
    );

    expect(screen.getByTestId('card-header')).toHaveAttribute('data-selected', 'Last 1 year');
  });

  it('forwards onSelect so the header can change the duration', () => {
    const onSelect = jest.fn();
    render(
      <StatCardShell
        title="Any"
        options={['Last week', 'Last month']}
        onSelect={onSelect}
        isEmpty={false}
      >
        <div>body</div>
      </StatCardShell>
    );

    fireEvent.click(screen.getByText('pick-last'));
    expect(onSelect).toHaveBeenCalledWith('Last month');
  });

  it('applies a caller-supplied card surface class instead of the default sizing', () => {
    const { container } = render(
      <StatCardShell
        title="Any"
        options={['Last week']}
        isEmpty={false}
        cardClassName="gap-3.5 overflow-hidden min-h-89"
      >
        <div>body</div>
      </StatCardShell>
    );

    const surface = container.querySelector('.min-h-89') as HTMLElement;
    expect(surface).toHaveClass('gap-3.5', 'overflow-hidden', 'rounded-[18px]');
    expect(surface).not.toHaveClass('min-h-75');
    expect(surface).not.toHaveClass('gap-2.5');
  });

  it('wraps the body in the shared warm-bone card surface', () => {
    const { container } = render(
      <StatCardShell title="Any" options={['Last 1 year']} isEmpty={false}>
        <div>body</div>
      </StatCardShell>
    );

    expect(container.querySelector('.min-h-75')).toHaveClass(
      'bg-[var(--screen)]',
      'border',
      'border-[var(--hairline)]',
      'rounded-[18px]',
      'min-h-75'
    );
  });
});
