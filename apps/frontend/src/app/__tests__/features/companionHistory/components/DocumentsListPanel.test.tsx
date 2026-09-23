import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import DocumentsListPanel from '@/app/features/companionHistory/components/DocumentsListPanel';

jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: ({ companionId }: { companionId: string }) => (
    <div data-testid="companion-documents-section">{companionId}</div>
  ),
}));

describe('DocumentsListPanel', () => {
  it('renders the Documents heading and passes companionId through', () => {
    render(<DocumentsListPanel companionId="comp-1" />);

    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByTestId('companion-documents-section')).toHaveTextContent('comp-1');
  });

  it('labels the section by the Documents heading for accessibility', () => {
    render(<DocumentsListPanel companionId="comp-2" />);

    const heading = screen.getByRole('heading', { name: 'Documents' });
    const section = heading.closest('section');
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
  });
});
