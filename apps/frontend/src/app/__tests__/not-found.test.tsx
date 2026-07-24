import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotFound from '@/app/not-found';

jest.mock('@/app/ui/layout/PublicShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="public-shell">{children}</div>
  ),
}));

jest.mock('@/app/ui/layout/UniversalSearch/UniversalSearchPalette', () => ({
  __esModule: true,
  default: () => <div data-testid="search-palette" />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('NotFound route', () => {
  it('renders the 404 state inside the public shell and mounts the search palette', () => {
    render(<NotFound />);

    expect(screen.getByTestId('public-shell')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('This page wandered off')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByTestId('search-palette')).toBeInTheDocument();
  });
});
