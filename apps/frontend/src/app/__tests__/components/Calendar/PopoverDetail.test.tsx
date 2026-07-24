import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PopoverDetail from '@/app/features/appointments/components/Calendar/common/PopoverDetail';

describe('PopoverDetail', () => {
  it('renders label and value without icon, emphasis, or scroll', () => {
    render(<PopoverDetail label="Status" value="Confirmed" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toHaveClass('block', 'truncate');
  });

  it('applies emphasized styling when emphasized is true', () => {
    render(<PopoverDetail label="Status" value="Confirmed" emphasized />);
    expect(screen.getByText('Confirmed').parentElement?.parentElement).toHaveClass(
      'font-bold',
      'text-[var(--ink)]'
    );
  });

  it('renders the icon when provided', () => {
    render(<PopoverDetail label="Status" value="Confirmed" icon={<span>icon</span>} />);
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('applies horizontal-scroll classes and handles wheel scroll when scrollValue is true', () => {
    render(<PopoverDetail label="Notes" value="Long text" scrollValue />);
    const valueSpan = screen.getByText('Long text');
    expect(valueSpan).toHaveClass('scrollbar-x-float');

    Object.defineProperty(valueSpan, 'scrollLeft', { writable: true, value: 0 });
    fireEvent.wheel(valueSpan, { deltaY: 40 });
    expect(valueSpan.scrollLeft).toBe(40);
  });

  it('does not adjust scrollLeft when wheel deltaY is 0', () => {
    render(<PopoverDetail label="Notes" value="Long text" scrollValue />);
    const valueSpan = screen.getByText('Long text');
    Object.defineProperty(valueSpan, 'scrollLeft', { writable: true, value: 5 });
    fireEvent.wheel(valueSpan, { deltaY: 0 });
    expect(valueSpan.scrollLeft).toBe(5);
  });
});
