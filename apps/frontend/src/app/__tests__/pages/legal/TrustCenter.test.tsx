import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import TrustCenter from '@/app/features/legal/pages/TrustCenter';

// Mock next/image to strip Next-specific props and render a plain <img>.
jest.mock('next/image', () => ({
  __esModule: true,
  default: (rawProps: Record<string, unknown>) => {
    const { src, alt, style, ...props } = rawProps;
    delete props.priority;
    delete props.fill;
    delete props.unoptimized;
    delete props.loader;
    return React.createElement('img', { src, alt, style, ...props });
  },
}));

expect.extend(toHaveNoViolations);

describe('TrustCenter', () => {
  beforeEach(() => render(<TrustCenter />));

  it('renders the hero title, eyebrow and meta line', () => {
    expect(
      screen.getByRole('heading', { name: 'Security, privacy and compliance', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(
      screen.getByText(/Updated February 2026 · support@yosemitecrew.com/i)
    ).toBeInTheDocument();
  });

  it('renders every section heading', () => {
    for (const heading of [
      'Our approach to trust',
      'Certifications and standards',
      'Security controls',
      'Data residency and encryption',
      'Subprocessors',
      'Resources',
      'Responsible disclosure',
    ]) {
      expect(screen.getByRole('heading', { name: heading, level: 2 })).toBeInTheDocument();
    }
  });

  it('renders certification cards with their names and statuses', () => {
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('SOC 2 Type I')).toBeInTheDocument();
    expect(screen.getByText('ISO 27001:2022')).toBeInTheDocument();
    expect(screen.getByText('21 CFR Part 11')).toBeInTheDocument();
    expect(screen.getByText('HIPAA')).toBeInTheDocument();
    expect(screen.getAllByText('COMPLIANT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PLANNED').length).toBeGreaterThan(0);
  });

  it('renders the security control pillars and their checklist items', () => {
    expect(screen.getByText('Organizational security')).toBeInTheDocument();
    expect(screen.getByText('Data privacy and operations')).toBeInTheDocument();
    expect(screen.getByText('AES-256 encryption at rest')).toBeInTheDocument();
    expect(screen.getByText('Business continuity plan, 99.99% uptime target')).toBeInTheDocument();
  });

  it('lists the subprocessors with their locations', () => {
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByText('Supabase, Inc.')).toBeInTheDocument();
    expect(screen.getByText('PostHog')).toBeInTheDocument();
    expect(screen.getByText('Luxembourg (EU)')).toBeInTheDocument();
    expect(screen.getByText('Singapore')).toBeInTheDocument();
  });

  it('links terms and the disclosure contacts correctly', () => {
    expect(screen.getByRole('link', { name: 'terms' })).toHaveAttribute(
      'href',
      '/terms-and-conditions'
    );
    expect(screen.getByRole('link', { name: 'security@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:security@yosemitecrew.com'
    );
    const statusLink = screen.getByRole('link', { name: 'our status page' });
    expect(statusLink).toHaveAttribute('href', 'https://yosemite-crew.openstatus.dev/');
    expect(statusLink).toHaveAttribute('target', '_blank');
    expect(statusLink).toHaveAttribute('rel', 'noopener');
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<TrustCenter />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
