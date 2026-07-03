import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/link', () => {
  return ({ children, ...props }: any) => <a {...props}>{children}</a>;
});

import Secondary from '@/app/ui/primitives/Buttons/Secondary';

describe('Secondary button', () => {
  test('renders secondary styles and href', () => {
    render(<Secondary text="Back" href="/previous" />);

    const link = screen.getByRole('link', { name: 'Back' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/previous');
  });

  test('calls custom onClick handler instead of navigating', () => {
    const handleClick = jest.fn();

    render(<Secondary text="Cancel" href="/cancel" onClick={handleClick} />);

    const link = screen.getByRole('link', { name: 'Cancel' });
    fireEvent.click(link);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick.mock.calls[0][0].defaultPrevented).toBe(true);
  });

  test('treats placeholder href values as buttons', () => {
    const handleClick = jest.fn();

    render(<Secondary text="Reject" href="#" onClick={handleClick} />);

    const button = screen.getByRole('button', { name: 'Reject' });
    fireEvent.click(button);

    expect(button).toBeInTheDocument();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('treats blank href values as buttons', () => {
    const handleClick = jest.fn();

    render(<Secondary text="Reject" href="   " onClick={handleClick} />);

    const button = screen.getByRole('button', { name: 'Reject' });
    fireEvent.click(button);

    expect(button).toBeInTheDocument();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('renders an icon alongside the button text', () => {
    render(<Secondary text="Back" icon={<span data-testid="secondary-icon" />} />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByTestId('secondary-icon')).toBeInTheDocument();
  });
});
