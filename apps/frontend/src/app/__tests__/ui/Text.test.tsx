import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Text from '@/app/ui/Text';

describe('Text', () => {
  it('renders the page-title style on the requested semantic element', () => {
    render(
      <Text as="h1" variant="page-title" className="text-text-primary">
        Payments and refunds
      </Text>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Payments and refunds' })).toHaveClass(
      'text-page-title',
      'text-text-primary'
    );
  });

  it('uses a body span when no variant or element is provided', () => {
    render(<Text>Activity</Text>);

    expect(screen.getByText('Activity').tagName).toBe('SPAN');
    expect(screen.getByText('Activity')).toHaveClass('text-body-4');
  });
});
