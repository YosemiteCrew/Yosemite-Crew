import React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import InventoryTurnoverFilters from '@/app/ui/filters/InventoryTurnoverFilters';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, onSelect, options }: any) => (
    <div>
      <span>{placeholder}</span>
      <button type="button" onClick={() => onSelect(options[2])}>
        pick-category
      </button>
    </div>
  ),
}));

describe('<InventoryTurnoverFilters />', () => {
  test('filters by status pills and category dropdown', () => {
    const setFilters = jest.fn();
    render(
      <InventoryTurnoverFilters
        filters={{ status: 'ALL', category: 'all' }}
        setFilters={setFilters}
        categories={['Medicine', 'Consumable']}
      />
    );

    // Open the status dropdown then click Excellent from the portal
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excellent' }));
    expect(setFilters).toHaveBeenCalledWith(expect.any(Function));
    expect(setFilters.mock.calls.at(-1)?.[0]({ status: 'ALL', category: 'all' })).toEqual({
      status: 'EXCELLENT',
      category: 'all',
    });

    fireEvent.click(screen.getByRole('button', { name: 'pick-category' }));
    expect(setFilters.mock.calls.at(-1)?.[0]({ status: 'ALL', category: 'all' })).toEqual({
      status: 'ALL',
      category: 'Consumable',
    });
  });

  test('resets an invalid category to all and closes the status menu on outside click and scroll', () => {
    const setFilters = jest.fn();
    const { rerender } = render(
      <div>
        <button type="button">outside</button>
        <InventoryTurnoverFilters
          filters={{ status: 'ALL', category: 'all' }}
          setFilters={setFilters}
          categories={['Medicine', 'Consumable']}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('button', { name: 'Excellent' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('button', { name: 'Excellent' })).not.toBeInTheDocument();

    rerender(
      <InventoryTurnoverFilters
        filters={{ status: 'ALL', category: 'Medicine' }}
        setFilters={setFilters}
        categories={['Unknown']}
      />
    );

    expect(screen.getByText('Category')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('button', { name: 'Excellent' })).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'Excellent' })).not.toBeInTheDocument();
  });
});
