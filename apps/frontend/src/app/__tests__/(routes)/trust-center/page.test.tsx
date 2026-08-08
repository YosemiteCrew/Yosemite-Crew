import React from 'react';
import { render, screen } from '@testing-library/react';
import TrustCenterPage, { metadata } from '@/app/(routes)/(public)/trust-center/page';

jest.mock('@/app/features/legal/pages/TrustCenter', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-trust-center">TrustCenter Component</div>,
}));

jest.mock('@/app/features/marketing/site', () => ({
  __esModule: true,
  MarketingShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-marketing-shell">{children}</div>
  ),
}));

describe('TrustCenterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes prototype-accurate metadata', () => {
    expect(metadata.title).toBe('Security, privacy and compliance · Yosemite Crew');
    expect(metadata.description).toContain('Protecting the data of pet businesses and pet parents');
  });

  it('renders TrustCenter inside the marketing shell', () => {
    render(<TrustCenterPage />);

    const shell = screen.getByTestId('mock-marketing-shell');
    const trustCenter = screen.getByTestId('mock-trust-center');
    expect(shell).toBeInTheDocument();
    expect(shell).toContainElement(trustCenter);
    expect(trustCenter).toHaveTextContent('TrustCenter Component');
  });
});
