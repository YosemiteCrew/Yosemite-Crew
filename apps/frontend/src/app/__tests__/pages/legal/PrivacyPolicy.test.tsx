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
      screen.getByRole('heading', { name: '3. Processing activities in applications', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: '8. What rights do you have with regard to the personal data you provide to us?',
        level: 2,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trademark notice', level: 2 })).toBeInTheDocument();
  });

  it('keeps the per-activity web and mobile application breakdown', () => {
    expect(
      screen.getByRole('heading', { name: '3.1. Web Application', level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3.2. Mobile Application', level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '3.2.4. Booking Appointments', level: 4 })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Legal basis:/i).length).toBeGreaterThan(10);
    expect(screen.getAllByText(/Storage period:/i).length).toBeGreaterThan(5);
  });

  it('lists recipients, social media presences and the GDPR rights', () => {
    expect(screen.getAllByText(/Supabase, Inc\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Amazon Web Services EMEA SARL/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'https://discord.gg/SwM6mX85KD' })).toHaveAttribute(
      'href',
      'https://discord.gg/SwM6mX85KD'
    );
    expect(
      screen.getByRole('heading', { name: /Art. 20 GDPR – Right to data portability/, level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'security@yosemitecrew.com' }).length
    ).toBeGreaterThan(0);
  });

  it('discloses the product analytics we actually run', () => {
    expect(
      screen.getByRole('heading', { name: 'Analytics (PostHog)', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/PostHog/).length).toBeGreaterThan(1);
  });

  it('keeps the data request form route for exercising rights', () => {
    expect(screen.getByRole('link', { name: 'data request form' })).toHaveAttribute(
      'href',
      '/contact-us'
    );
  });
});
