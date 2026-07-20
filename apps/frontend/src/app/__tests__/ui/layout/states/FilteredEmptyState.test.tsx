import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilteredEmptyState from '@/app/ui/layout/states/FilteredEmptyState';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('FilteredEmptyState', () => {
  it('renders the default copy and hides the clear button without a handler', () => {
    render(<FilteredEmptyState />);

    expect(screen.getByText('Nothing matches these filters')).toBeInTheDocument();
    expect(
      screen.getByText('Try widening the date range or clearing a status filter.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('renders custom copy and wires the clear-filters handler', () => {
    const onClearFilters = jest.fn();
    render(
      <FilteredEmptyState
        title="No visits found"
        message="Adjust the range."
        clearLabel="Reset filters"
        onClearFilters={onClearFilters}
      />
    );

    expect(screen.getByText('No visits found')).toBeInTheDocument();
    expect(screen.getByText('Adjust the range.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Reset filters'));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
