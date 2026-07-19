import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskFilterBar from '@/app/features/tasks/components/TaskFilterBar';
import { TaskFilters, TaskStatusFilters } from '@/app/features/tasks/types/task';

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe('TaskFilterBar', () => {
  const setActiveFilter = jest.fn();
  const setActiveStatus = jest.fn();
  const onAddButtonClick = jest.fn();

  const renderBar = (overrides: Partial<React.ComponentProps<typeof TaskFilterBar>> = {}) =>
    render(
      <TaskFilterBar
        filterOptions={TaskFilters}
        statusOptions={TaskStatusFilters}
        activeFilter="all"
        activeStatus="all"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
        showAddButton
        onAddButtonClick={onAddButtonClick}
        {...overrides}
      />
    );

  beforeEach(() => jest.clearAllMocks());

  it('renders the audience pills and inline status pills (no All-status pill, no dropdown)', () => {
    renderBar();

    // Audience pills.
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pet parents' })).toBeInTheDocument();

    // Inline status pills — the "All" status is dropped from the row.
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.queryByText('All statuses')).not.toBeInTheDocument();
  });

  it('toggles the audience filter and back to all', () => {
    const { rerender } = renderBar({ activeFilter: 'all' });
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(setActiveFilter).toHaveBeenCalledWith('employee_task');

    rerender(
      <TaskFilterBar
        filterOptions={TaskFilters}
        statusOptions={TaskStatusFilters}
        activeFilter="employee_task"
        activeStatus="all"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(setActiveFilter).toHaveBeenLastCalledWith('all');
  });

  it('toggles a status pill and clears it back to all when active', () => {
    const { rerender } = renderBar({ activeStatus: 'all' });
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(setActiveStatus).toHaveBeenCalledWith('completed');

    rerender(
      <TaskFilterBar
        filterOptions={TaskFilters}
        statusOptions={TaskStatusFilters}
        activeFilter="all"
        activeStatus="completed"
        setActiveFilter={setActiveFilter}
        setActiveStatus={setActiveStatus}
      />
    );
    // Active status pill toggles back to "all".
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(setActiveStatus).toHaveBeenLastCalledWith('all');
  });

  it('marks the active audience and status pills via aria-pressed', () => {
    renderBar({ activeFilter: 'employee_task', activeStatus: 'in_progress' });
    expect(screen.getByRole('button', { name: 'Team' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'In progress' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the add button only when permitted', () => {
    const { unmount } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'New task' }));
    expect(onAddButtonClick).toHaveBeenCalled();
    unmount();

    renderBar({ showAddButton: false });
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
  });

  it('renders nothing for the status divider when no status pills are supplied', () => {
    renderBar({ statusOptions: [] });
    expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument();
    // Audience pills still render.
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });
});
