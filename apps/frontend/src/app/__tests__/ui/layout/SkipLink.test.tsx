import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import SkipLink from '@/app/ui/layout/SkipLink';

expect.extend(toHaveNoViolations);

describe('SkipLink', () => {
  it('links to the main content anchor', () => {
    render(<SkipLink />);

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
  });

  it('has no axe accessibility violations', async () => {
    const { container } = render(<SkipLink />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
