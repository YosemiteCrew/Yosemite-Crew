import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BoardScopeToggle from '@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle';

describe('BoardScopeToggle', () => {
  it('uses the stronger success color for the active right option', () => {
    const onChange = jest.fn();
    const { container } = render(
      <BoardScopeToggle
        showMineOnly={true}
        onChange={onChange}
        allLabel="Inventory"
        mineLabel="Turnover"
      />
    );

    const slider = container.querySelector("[aria-hidden='true']");
    expect(slider).toHaveClass('bg-success-700');
    expect(slider).toHaveClass('border-success-700');
    expect(screen.getByRole('button', { name: 'Turnover' })).toHaveClass('text-neutral-0');
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
});
