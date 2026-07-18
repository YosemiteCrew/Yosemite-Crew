import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SegmentedPill from '@/app/ui/primitives/SegmentedPill/SegmentedPill';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('SegmentedPill', () => {
  it('marks the active option as pressed and the others not', () => {
    render(<SegmentedPill options={OPTIONS} value="a" onChange={jest.fn()} ariaLabel="Choice" />);

    expect(screen.getByRole('group', { name: 'Choice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the option value when a segment is clicked', () => {
    const onChange = jest.fn();
    render(<SegmentedPill options={OPTIONS} value="a" onChange={onChange} ariaLabel="Choice" />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not fire onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <SegmentedPill options={OPTIONS} value="a" onChange={onChange} ariaLabel="Choice" disabled />
    );

    const beta = screen.getByRole('button', { name: 'Beta' });
    expect(beta).toBeDisabled();
    fireEvent.click(beta);
    expect(onChange).not.toHaveBeenCalled();
  });
});
