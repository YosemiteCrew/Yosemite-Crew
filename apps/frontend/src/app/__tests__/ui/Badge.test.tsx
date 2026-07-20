import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Badge from '@/app/ui/Badge';

describe('Badge', () => {
  it('renders with neutral tone by default', () => {
    render(<Badge data-testid="badge">Default</Badge>);
    const badge = screen.getByTestId('badge');

    expect(badge).toHaveTextContent('Default');
    expect(badge.className).toContain('bg-card-bg');
    expect(badge.className).toContain('text-text-secondary');
  });

  it('applies selected tone and custom className', () => {
    render(
      <Badge tone="danger" className="extra" data-testid="badge">
        Delete
      </Badge>
    );

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-danger-100');
    expect(badge.className).toContain('text-danger-700');
    expect(badge.className).toContain('extra');
  });
});
