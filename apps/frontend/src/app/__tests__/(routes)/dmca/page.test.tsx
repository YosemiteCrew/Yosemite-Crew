import React from 'react';
import { render, screen } from '@testing-library/react';
import DmcaPage from '@/app/(routes)/(public)/dmca/page';

jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  MarketingShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-shell">{children}</div>
  ),
}));

jest.mock('@/app/features/legal/pages/DmcaCopyrightPolicy', () => ({
  __esModule: true,
  default: () => <main data-testid="mock-dmca-policy">DMCA Policy</main>,
}));

describe('DmcaPage', () => {
  it('renders the DMCA policy inside the marketing shell', () => {
    render(<DmcaPage />);

    expect(screen.getByTestId('marketing-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mock-dmca-policy')).toHaveTextContent('DMCA Policy');
  });
});
