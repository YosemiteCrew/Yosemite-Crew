import React from 'react';
import { render, screen } from '@testing-library/react';

import Page from '@/app/(routes)/(app)/companions/history/page';

jest.mock('@/app/features/companionHistory/pages/CompanionHistoryPage', () => ({
  __esModule: true,
  default: () => <div data-testid="companion-history-page">History</div>,
}));

describe('Companion history route', () => {
  it('renders companion history page', () => {
    render(<Page />);
    expect(screen.getByTestId('companion-history-page')).toBeInTheDocument();
  });
});
