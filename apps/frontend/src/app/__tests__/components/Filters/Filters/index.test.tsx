import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Filters from '@/app/ui/filters/Filters';

const filterOptions = [
  { key: 'all', name: 'All' },
  { key: 'recent', name: 'Recent' },
];

const statusOptions = [
  { key: 'available', name: 'Available', bg: '#eee', text: '#111' },
  { key: 'requested', name: 'Requested', bg: '#ddd', text: '#222' },
];

describe('Filters', () => {
  it('renders filter and status buttons and handles clicks', () => {
    const setActiveFilter = jest.fn();
    const setActiveStatus = jest.fn();

    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="requested"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
      />
    );

    fireEvent.click(screen.getByText('Recent'));
    expect(setActiveFilter).toHaveBeenCalledWith('recent');

    fireEvent.click(screen.getByRole('button', { name: 'Requested' }));
    fireEvent.click(screen.getByRole('button', { name: 'Available' }));
    expect(setActiveStatus).toHaveBeenCalledWith('available');
  });

  it('renders add appointment button next to filters when enabled', () => {
    const onAddButtonClick = jest.fn();

    render(
      <Filters
        filterOptions={filterOptions}
        statusOptions={statusOptions}
        activeFilter="all"
        activeStatus="requested"
        setActiveFilter={jest.fn()}
        setActiveStatus={jest.fn()}
        showAddButton
        onAddButtonClick={onAddButtonClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Appointment' }));
    expect(onAddButtonClick).toHaveBeenCalledTimes(1);
  });
});
