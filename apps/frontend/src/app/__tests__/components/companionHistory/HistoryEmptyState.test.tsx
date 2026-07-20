import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryEmptyState from '@/app/features/companionHistory/components/HistoryEmptyState';

describe('HistoryEmptyState', () => {
  it('renders the rich records empty state for the plain non-error case', () => {
    render(<HistoryEmptyState />);

    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a provided non-error message in the compact notice box', () => {
    render(<HistoryEmptyState message="No audit entries found." />);

    expect(screen.getByText('No audit entries found.')).toBeInTheDocument();
    expect(screen.queryByText('No records yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders default error message and alert role for error state', () => {
    render(<HistoryEmptyState isError />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to load overview right now.')).toBeInTheDocument();
  });

  it('renders provided custom message', () => {
    render(<HistoryEmptyState isError message="Custom error" />);

    expect(screen.getByText('Custom error')).toBeInTheDocument();
  });
});
