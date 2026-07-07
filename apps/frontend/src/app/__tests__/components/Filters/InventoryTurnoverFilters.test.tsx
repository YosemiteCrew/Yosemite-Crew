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
  const list = [
    { name: 'Med A', category: 'Medicine', status: 'Excellent' },
    { name: 'Supply', category: 'Consumable', status: 'Low' },
  ];

  test('filters by status pills and category dropdown', () => {
    const setFilteredList = jest.fn();
    render(
      <InventoryTurnoverFilters
        list={list as any}
        setFilteredList={setFilteredList}
        categories={['Medicine', 'Consumable']}
      />
    );

    expect(setFilteredList).toHaveBeenCalled();
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual(list);

    // Open the status dropdown then click Excellent from the portal
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excellent' }));
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([list[0]]);

    // Open again and reset to All
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Excellent' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick-category' }));
    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual([list[1]]);
  });

  test('resets an invalid category to all and closes the status menu on outside click and scroll', () => {
    const setFilteredList = jest.fn();
    const { rerender } = render(
      <div>
        <button type="button">outside</button>
        <InventoryTurnoverFilters
          list={list as any}
          setFilteredList={setFilteredList}
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
        list={list as any}
        setFilteredList={setFilteredList}
        categories={['Unknown']}
      />
    );

    expect(setFilteredList.mock.calls.at(-1)?.[0]).toEqual(list);

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.getByRole('button', { name: 'Excellent' })).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'Excellent' })).not.toBeInTheDocument();
  });
});
