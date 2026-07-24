import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateOrgCard from '@/app/ui/cards/CreateOrgCard/CreateOrgCard';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('CreateOrgCard', () => {
  it('renders a dashed create link pointing to /create-org by default', () => {
    render(<CreateOrgCard />);
    const link = screen.getByRole('link', { name: /Create a new organization/i });
    expect(link).toHaveAttribute('href', '/create-org');
  });

  it('honors a custom href', () => {
    render(<CreateOrgCard href="/onboarding/new" />);
    const link = screen.getByRole('link', { name: /Create a new organization/i });
    expect(link).toHaveAttribute('href', '/onboarding/new');
  });
});
