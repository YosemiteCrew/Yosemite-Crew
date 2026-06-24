import React from 'react';
import { render, screen } from '@testing-library/react';
import DmcaPage from '@/app/(routes)/(public)/dmca/page';

jest.mock('@/app/features/legal/pages/DmcaCopyrightPolicy', () => ({
  __esModule: true,
  default: () => <main data-testid="mock-dmca-policy">DMCA Policy</main>,
}));

jest.mock('@/app/ui/widgets/Footer/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="mock-footer">Footer Component</footer>,
}));

describe('DmcaPage', () => {
  it('renders the DMCA policy and public footer', () => {
    render(<DmcaPage />);

    expect(screen.getByTestId('mock-dmca-policy')).toHaveTextContent('DMCA Policy');
    expect(screen.getByTestId('mock-footer')).toHaveTextContent('Footer Component');
  });
});
