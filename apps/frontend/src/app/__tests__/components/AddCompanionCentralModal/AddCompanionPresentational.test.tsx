import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AlertChipView,
  AlertChipEdit,
} from '@/app/features/companions/components/AddCompanionCentralModal/AddCompanionPresentational';
import type { CompanionAlert } from '@/app/features/companions/components/AddCompanion/type';

// ─── AlertChipView / AlertChipEdit — StatusPill geometry parity ────────────────
//
// Both chips must render the same box the design system's `StatusPill` uses
// (10px/700 uppercase, +0.08em tracking, 3px 10px padding, `leading: normal`) so
// an alert badge doesn't visibly mismatch every other status pill in the app.
// `AlertChipView` renders `StatusPill` directly; `AlertChipEdit` keeps its own
// markup for the inline remove button but must match its geometry.

const alert: CompanionAlert = { id: 'a1', label: 'Diabetic', priority: 'high' };

describe('AlertChipView', () => {
  it('renders through the shared StatusPill box', () => {
    render(<AlertChipView alert={alert} />);
    const chip = screen.getByText('Diabetic');
    expect(chip).toHaveClass(
      'yc-status-pill',
      'px-2.5',
      'leading-[normal]',
      'uppercase',
      'tracking-[0.08em]'
    );
  });

  it('colours from the alert priority config', () => {
    render(<AlertChipView alert={alert} />);
    expect(screen.getByText('Diabetic')).toHaveStyle({ backgroundColor: 'var(--danger-bg)' });
  });

  it('falls back to the medium tone for an unrecognised priority', () => {
    render(<AlertChipView alert={{ id: 'a2', label: 'Odd', priority: 'unknown' as never }} />);
    expect(screen.getByText('Odd')).toHaveStyle({ backgroundColor: 'var(--warn-bg)' });
  });
});

describe('AlertChipEdit', () => {
  it('matches StatusPill geometry: 2.5 padding, normal leading, uppercase, +0.08em tracking', () => {
    render(<AlertChipEdit alert={alert} onRemove={jest.fn()} />);
    const chip = screen.getByText('Diabetic').closest('span');
    expect(chip).toHaveClass('px-2.5', 'leading-[normal]', 'uppercase', 'tracking-[0.08em]');
    // Not px-[9px] / leading-[1.4] — the pre-fix geometry that mismatched StatusPill.
    expect(chip).not.toHaveClass('px-[9px]');
    expect(chip).not.toHaveClass('leading-[1.4]');
  });

  it('removes the alert when its close button is clicked', () => {
    const onRemove = jest.fn();
    render(<AlertChipEdit alert={alert} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove alert Diabetic' }));
    expect(onRemove).toHaveBeenCalledWith('a1');
  });
});
