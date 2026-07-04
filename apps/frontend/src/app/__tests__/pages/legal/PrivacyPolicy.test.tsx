import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyPolicy from '@/app/features/legal/pages/PrivacyPolicy';

describe('PrivacyPolicy', () => {
  beforeEach(() => render(<PrivacyPolicy />));

  it('renders the page title and controller meta', () => {
    expect(screen.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/Controller: DuneXploration UG \(haftungsbeschränkt\), Mainz/i)
    ).toBeInTheDocument();
  });

  it('renders key section headings', () => {
    expect(
      screen.getByRole('heading', { name: '1. Controller and Data Protection Officer', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3. What we process, and why', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '9. Your rights', level: 2 })).toBeInTheDocument();
  });

  it('lists subprocessors and links to the data request form', () => {
    expect(screen.getByText(/Supabase, Inc\./i)).toBeInTheDocument();
    expect(screen.getByText(/Amazon Web Services EMEA SARL/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'data request form' })).toHaveAttribute(
      'href',
      '/contact-us'
    );
    expect(
      screen.getAllByRole('link', { name: 'security@yosemitecrew.com' }).length
    ).toBeGreaterThan(0);
  });
});
