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

  it('renders the contractual Discord invite in Exhibit A, at both occurrences', () => {
    // Exhibit A states the support channel as a contractual commitment and
    // repeats it, so a mistyped or dropped invite in a later edit must fail here
    // rather than silently changing what the terms promise.
    const links = screen
      .getAllByRole('link', { name: 'https://discord.gg/SwM6mX85KD' })
      .filter((el) => el.getAttribute('href') === 'https://discord.gg/SwM6mX85KD');

    expect(links).toHaveLength(2);
  });

  it('keeps the acceptable-use restrictions on prompt injection and generated output', () => {
    expect(screen.getByText(/prompt-injection attacks/)).toBeInTheDocument();
    // section 12's clauses were duplicated as a nested sublist on the old page
    expect(screen.getAllByText(/unnecessarily interferes with the normal operation/)).toHaveLength(
      1
    );
  });

  it('renders key numbered section headings', () => {
    expect(screen.getByRole('heading', { name: '1. Definitions', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '15. Limitation of liability', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '20. Miscellaneous', level: 2 })
    ).toBeInTheDocument();
  });

  it('renders the exhibits and the standard contractual clauses appendices', () => {
    for (const name of [
      'Exhibit A: Support Services and Service Level Policy',
      'Exhibit B: Data Processing Agreement',
      'Appendix 1: Standard Contractual Clauses',
      'Appendix 2: Annex Standard Contractual Clauses',
    ]) {
      expect(screen.getByRole('heading', { name, level: 2 })).toBeInTheDocument();
    }
    // Exhibit A ships only once: the old page duplicated its definitions block.
    expect(screen.getAllByText(/1.1. Emergency Downtime/)).toHaveLength(1);
  });

  it('keeps the formal defined terms, liability cap and support contacts', () => {
    expect(screen.getAllByText(/Business Owner/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/5,000 EUR/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'support@yosemitecrew.com' })[0]).toHaveAttribute(
      'href',
      'mailto:support@yosemitecrew.com'
    );
    expect(screen.getAllByRole('link', { name: 'security@yosemitecrew.com' })[0]).toHaveAttribute(
      'href',
      'mailto:security@yosemitecrew.com'
    );
  });

  it('renders the annex data tables with accessible headers', () => {
    expect(screen.getAllByRole('columnheader', { name: 'Module' }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('columnheader', { name: 'Categories of personal data' }).length
    ).toBeGreaterThan(0);
  });
});
