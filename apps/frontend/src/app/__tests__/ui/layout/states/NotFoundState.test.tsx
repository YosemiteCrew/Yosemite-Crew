import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotFoundState from '@/app/ui/layout/states/NotFoundState';
import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('NotFoundState', () => {
  beforeEach(() => {
    useUniversalSearchStore.setState({ isOpen: false });
  });

  it('renders the 404 numeral, copy, and default dashboard action', () => {
    render(<NotFoundState />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('This page wandered off')).toBeInTheDocument();
    expect(
      screen.getByText('The link may be old, or the record was moved to another organization.')
    ).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('Search ⌘K')).toBeInTheDocument();
  });

  it('opens the universal search palette from the default search action', () => {
    render(<NotFoundState />);

    fireEvent.click(screen.getByText('Search ⌘K'));

    expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  });

  it('honours a custom search handler and home target', () => {
    const onSearch = jest.fn();
    render(<NotFoundState homeHref="/finance" homeLabel="Back to Finance" onSearch={onSearch} />);

    expect(screen.getByText('Back to Finance').closest('a')).toHaveAttribute('href', '/finance');
    fireEvent.click(screen.getByText('Search ⌘K'));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(useUniversalSearchStore.getState().isOpen).toBe(false);
  });
});
