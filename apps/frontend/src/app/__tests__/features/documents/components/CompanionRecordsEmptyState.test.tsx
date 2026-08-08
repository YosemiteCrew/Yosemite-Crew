import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import CompanionRecordsEmptyState from '@/app/features/documents/components/CompanionRecordsEmptyState';

describe('CompanionRecordsEmptyState', () => {
  it('renders the headline and supporting copy without an action', () => {
    render(<CompanionRecordsEmptyState />);
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByText(/Everything from visits lands here automatically/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the provided action when one is passed', () => {
    render(<CompanionRecordsEmptyState action={<button type="button">Upload record</button>} />);
    expect(screen.getByRole('button', { name: 'Upload record' })).toBeInTheDocument();
  });
});
