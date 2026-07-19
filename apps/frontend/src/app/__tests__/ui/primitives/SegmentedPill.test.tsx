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

  it('renders the small segment size by default', () => {
    render(<SegmentedPill options={OPTIONS} value="a" onChange={jest.fn()} ariaLabel="Choice" />);

    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveClass(
      'px-[13px]',
      'py-[5px]',
      'text-[11.5px]'
    );
    expect(screen.getByRole('group', { name: 'Choice' })).toHaveClass('inline-flex');
  });

  it.each([
    ['md' as const, ['px-[14px]', 'py-[5px]', 'text-[12px]']],
    ['lg' as const, ['px-[15px]', 'py-[6px]', 'text-[12.5px]']],
  ])('applies the %s segment size', (size, expectedClasses) => {
    render(
      <SegmentedPill
        options={OPTIONS}
        value="a"
        onChange={jest.fn()}
        ariaLabel="Choice"
        size={size}
      />
    );

    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveClass(...expectedClasses);
  });

  it('stretches the track with equal-width segments when fullWidth is set', () => {
    render(
      <SegmentedPill
        options={OPTIONS}
        value="a"
        onChange={jest.fn()}
        ariaLabel="Choice"
        size="md"
        fullWidth
      />
    );

    expect(screen.getByRole('group', { name: 'Choice' })).toHaveClass('flex', 'w-full');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveClass(
      'flex-1',
      'text-center',
      'py-[6px]',
      'text-[12px]'
    );
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
