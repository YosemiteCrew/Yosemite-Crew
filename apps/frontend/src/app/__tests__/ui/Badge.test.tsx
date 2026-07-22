import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Badge from '@/app/ui/Badge';

describe('Badge', () => {
  it('renders with neutral tone by default', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');

    expect(badge).toHaveTextContent('Default');
    expect(badge).toHaveStyle({
      backgroundColor: 'var(--color-pill-neutral-bg)',
      color: 'var(--color-pill-neutral-text)',
    });
  });

  it('maps the brand tone onto the accent pill tone', () => {
    render(<Badge tone="brand">Bookable</Badge>);

    expect(screen.getByText('Bookable')).toHaveStyle({
      backgroundColor: 'var(--color-pill-accent-bg)',
    });
  });

  it('applies selected tone and custom className', () => {
    render(
      <Badge tone="danger" className="extra">
        Delete
      </Badge>
    );

    const badge = screen.getByText('Delete');
    expect(badge).toHaveStyle({
      backgroundColor: 'var(--color-pill-warning-bg)',
      color: 'var(--color-pill-warning-text)',
    });
    expect(badge.className).toContain('extra');
  });
});
