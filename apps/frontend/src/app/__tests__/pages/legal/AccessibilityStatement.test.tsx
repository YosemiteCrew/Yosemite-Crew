import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccessibilityStatement from '@/app/features/legal/pages/AccessibilityStatement';

describe('AccessibilityStatement', () => {
  beforeEach(() => render(<AccessibilityStatement />));

  it('renders the page title and WCAG meta', () => {
    expect(
      screen.getByRole('heading', { name: 'Accessibility Statement', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Target: WCAG 2.2 Level AA/i)).toBeInTheDocument();
  });

  it('renders key section headings and conformance status', () => {
    expect(screen.getByRole('heading', { name: 'Our commitment', level: 2 })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Conformance status', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Report an accessibility barrier', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Partially conformant\./i)).toBeInTheDocument();
  });

  it('links to the accessibility report form and the barrier email', () => {
    expect(screen.getByRole('link', { name: 'accessibility barrier report form' })).toHaveAttribute(
      'href',
      '/accessibility/report'
    );
    expect(screen.getByRole('link', { name: 'accessibility@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:accessibility@yosemitecrew.com'
    );
  });
});
