import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HamburgerMenuButton from '@/app/ui/layout/Header/HamburgerMenuButton';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: any) => <div className={className}>{children}</div>,
    span: ({ children, className }: any) => <span className={className}>{children}</span>,
  },
}));

describe('HamburgerMenuButton', () => {
  it('renders open-menu label when closed and calls onClick', () => {
    const onClick = jest.fn();
    render(<HamburgerMenuButton menuOpen={false} onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders close-menu label when open', () => {
    render(<HamburgerMenuButton menuOpen onClick={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });
});
