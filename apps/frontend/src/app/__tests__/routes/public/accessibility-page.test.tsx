import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AccessibilityPage, { metadata } from '@/app/(routes)/(public)/accessibility/page';

jest.mock('@/app/ui/widgets/Footer/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="footer" />,
}));

describe('AccessibilityPage', () => {
  it('renders a global accessibility statement without Germany-specific legal references', () => {
    render(<AccessibilityPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Accessibility Statement' })
    ).toBeInTheDocument();
    expect(screen.getByText(/WCAG 2\.2 Level AA/i)).toBeInTheDocument();
    expect(screen.getByText(/Measures we take/i)).toBeInTheDocument();
    expect(screen.getByText(/Alternative formats and support/i)).toBeInTheDocument();

    const pageText = document.body.textContent ?? '';
    expect(pageText).not.toMatch(/BFSG|Barrierefreiheitsstärkungsgesetz|Germany|German/i);
  });

  it('keeps direct feedback paths available', () => {
    render(<AccessibilityPage />);

    expect(
      screen.getByRole('link', { name: 'Use our accessibility barrier report form' })
    ).toHaveAttribute('href', '/accessibility/report');
    expect(screen.getByRole('link', { name: 'accessibility@yosemitecrew.com' })).toHaveAttribute(
      'href',
      'mailto:accessibility@yosemitecrew.com'
    );
  });

  it('keeps metadata globally scoped', () => {
    expect(metadata.description).toContain('WCAG 2.2 Level AA');
    expect(metadata.description).not.toMatch(/BFSG|Germany|German/i);
  });
});
