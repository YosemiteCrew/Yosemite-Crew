import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Close from '@/app/ui/primitives/Icons/Close';

describe('Close', () => {
  it('renders a close button by default', () => {
    render(<Close />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClick when the button is clicked', () => {
    const onClick = jest.fn();
    render(<Close onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the given tabIndex to the button', () => {
    render(<Close tabIndex={-1} />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('tabindex', '-1');
  });

  it('renders only the bare icon (no button) when iconOnly is true', () => {
    render(<Close iconOnly />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
