import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Impressum from '@/app/features/legal/pages/Impressum';

describe('Impressum', () => {
  beforeEach(() => render(<Impressum />));

  it('renders the page title and legal-notice subtitle', () => {
    expect(screen.getByRole('heading', { name: 'Impressum', level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/Legal notice and provider identification under § 5 DDG/i)
    ).toBeInTheDocument();
  });

  it('renders the provider and register sections', () => {
    expect(
      screen.getByRole('heading', { name: 'Provider (Angaben gemäß § 5 DDG)', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Register entry', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Registered at Amtsgericht Mainz, HRB 52778/)).toBeInTheDocument();
    expect(screen.getByText(/DE367920596/)).toBeInTheDocument();
  });

  it('links to the phone number and ODR platform', () => {
    expect(screen.getByRole('link', { name: '+49 152 277 63275' })).toHaveAttribute(
      'href',
      'tel:+4915227763275'
    );
    expect(
      screen.getByRole('link', { name: 'https://ec.europa.eu/consumers/odr/' })
    ).toHaveAttribute('target', '_blank');
  });
});
