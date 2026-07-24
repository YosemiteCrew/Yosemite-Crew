import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BoardScopeToggle from '@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle';

describe('BoardScopeToggle', () => {
  it('marks the active segment as a raised neutral pill (not a colored fill)', () => {
    const onChange = jest.fn();
    render(
      <BoardScopeToggle
        showMineOnly={true}
        onChange={onChange}
        allLabel="Inventory"
        mineLabel="Turnover"
      />
    );

    // showMineOnly=true → the right ("Turnover") option is active.
    const active = screen.getByRole('button', { name: 'Turnover' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveClass('bg-[var(--screen)]');
    expect(active).toHaveClass('font-bold');
    expect(active).not.toHaveClass('bg-success-700');

    const inactive = screen.getByRole('button', { name: 'Inventory' });
    expect(inactive).toHaveAttribute('aria-pressed', 'false');
    expect(inactive).not.toHaveClass('bg-[var(--screen)]');
  });

  it('changes scope when either option is pressed', () => {
    const onChange = jest.fn();
    render(
      <BoardScopeToggle
        showMineOnly={false}
        onChange={onChange}
        allLabel="Inventory"
        mineLabel="Turnover"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Turnover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));

    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, false);
  });

  it('dims the control and blocks changes when disabled', () => {
    const onChange = jest.fn();
    render(
      <BoardScopeToggle
        showMineOnly={false}
        disabled
        onChange={onChange}
        allLabel="Inventory"
        mineLabel="Turnover"
      />
    );
    const btn = screen.getByRole('button', { name: 'Turnover' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('cursor-not-allowed');
  });
});
