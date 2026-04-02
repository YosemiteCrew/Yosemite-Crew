import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import BoardScopeToggle from '@/app/ui/primitives/BoardScopeToggle/BoardScopeToggle';

describe('BoardScopeToggle', () => {
  it('calls onChange with expected values', () => {
    const onChange = jest.fn();
    render(
      <BoardScopeToggle showMineOnly={false} onChange={onChange} allLabel="All" mineLabel="Mine" />
    );

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));

    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
  });

  it('disables both buttons when disabled is true', () => {
    render(
      <BoardScopeToggle
        showMineOnly={true}
        disabled={true}
        onChange={jest.fn()}
        allLabel="All"
        mineLabel="Mine"
      />
    );

    expect(screen.getByRole('button', { name: 'All' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mine' })).toBeDisabled();
  });
});
