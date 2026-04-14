import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryEmptyState from '@/app/features/companionHistory/components/HistoryEmptyState';

describe('HistoryEmptyState', () => {
  it('renders default empty message for non-error state', () => {
    render(<HistoryEmptyState />);

    expect(screen.getByText('No overview entries found.')).toBeInTheDocument();
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
