import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FilterChip from '@/app/ui/filters/FilterChip';

describe('FilterChip', () => {
  it('renders the count inside the chip and drops the faint ink when active', () => {
    const { rerender } = render(
      <FilterChip label="Completed" active={false} count={271} onClick={jest.fn()} />
    );

    // The count is a child of the chip, not a sibling badge.
    expect(screen.getByRole('button', { name: 'Completed 271' })).toBeInTheDocument();
    expect(screen.getByText('271')).toHaveClass('text-[var(--ink-faint)]');

    rerender(<FilterChip label="Completed" active count={271} onClick={jest.fn()} />);
    /* Active: the count drops the faint token and inherits the chip's ink, so
       it stays legible on the danger tone too. No opacity — the app-scope
       alias-closure test forbids compositing a faint ink under one, which is
       what drops it below AA, and on a solid selected fill the label ink is
       already legible. */
    expect(screen.getByText('271')).not.toHaveClass('text-[var(--ink-faint)]');
    expect(screen.getByText('271').className).not.toMatch(/opacity-/);
  });

  it('hides a decorative dot from the accessibility tree and names a meaningful one', () => {
    const { rerender } = render(
      <FilterChip label="Emergencies" active={false} dotColor="var(--danger)" onClick={jest.fn()} />
    );

    expect(screen.queryByLabelText('Emergency appointments present')).not.toBeInTheDocument();

    rerender(
      <FilterChip
        label="Emergencies"
        active={false}
        dotColor="var(--danger)"
        dotLabel="Emergency appointments present"
        onClick={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Emergency appointments present')).toBeInTheDocument();
  });

  it('keeps the danger tone in both states', () => {
    const { rerender } = render(
      <FilterChip label="Emergencies" active={false} tone="danger" onClick={jest.fn()} />
    );

    const chip = () => screen.getByRole('button', { name: 'Emergencies' });
    expect(chip()).toHaveClass('text-[var(--danger-text)]!');
    expect(chip()).not.toHaveClass('bg-[var(--danger-bg)]');

    rerender(<FilterChip label="Emergencies" active tone="danger" onClick={jest.fn()} />);
    expect(chip()).toHaveClass('bg-[var(--danger-bg)]', 'text-[var(--danger-text)]!');
  });

  it('uses domain tokens only while active without losing the shared focus treatment', () => {
    const { rerender } = render(
      <FilterChip
        label="Awaiting payment"
        active
        tokens={{
          bg: 'var(--status-upcoming-bg)',
          text: 'var(--status-upcoming-text)',
          border: 'var(--status-upcoming-border)',
        }}
        onClick={jest.fn()}
      />
    );

    const chip = () => screen.getByRole('button', { name: 'Awaiting payment' });
    expect(chip()).toHaveClass('h-8', 'text-[12.5px]', 'focus-visible:ring-2');
    expect(chip()).toHaveStyle({
      backgroundColor: 'var(--status-upcoming-bg)',
      color: 'var(--status-upcoming-text)',
      borderColor: 'var(--status-upcoming-border)',
      fontWeight: '700',
    });

    rerender(
      <FilterChip
        label="Awaiting payment"
        active={false}
        tokens={{ bg: 'var(--status-upcoming-bg)' }}
        onClick={jest.fn()}
      />
    );
    expect(chip()).not.toHaveStyle({ backgroundColor: 'var(--status-upcoming-bg)' });
    expect(chip()).toHaveClass('text-[var(--ink-muted)]');
  });

  it('does not fire onClick while disabled', () => {
    const onClick = jest.fn();
    render(<FilterChip label="Archived" active={false} disabled onClick={onClick} />);

    const chip = screen.getByRole('button', { name: 'Archived' });
    expect(chip).toHaveClass('cursor-not-allowed', 'opacity-60');
    fireEvent.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('takes an explicit aria-label and extra classes from the caller', () => {
    render(
      <FilterChip
        label="All"
        active
        onClick={jest.fn()}
        aria-label="All appointments"
        className="ml-2"
      />
    );

    const chip = screen.getByRole('button', { name: 'All appointments' });
    expect(chip).toHaveClass('ml-2');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
