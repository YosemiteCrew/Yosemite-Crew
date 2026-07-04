import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TermsAndConditions from '@/app/features/legal/pages/TermsAndConditions';

describe('TermsAndConditions', () => {
  beforeEach(() => render(<TermsAndConditions />));

  it('renders the page title and lead-in meta', () => {
    expect(
      screen.getByRole('heading', { name: 'Terms and conditions', level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/DuneXploration UG \(haftungsbeschränkt\), Mainz/i)
    ).toBeInTheDocument();
  });

  it('renders key numbered section headings', () => {
    expect(screen.getByRole('heading', { name: '1. Definitions', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '15. Limitation of liability', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '19. Governing law and jurisdiction', level: 2 })
    ).toBeInTheDocument();
  });

  it('keeps the formal defined terms and DPA contact', () => {
    expect(screen.getAllByText(/Business Owner/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/EUR 5,000/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'security@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:security@yosemitecrew.com'
    );
  });
});
