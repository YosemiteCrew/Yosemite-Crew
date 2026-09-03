import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskFilterBar from '@/app/features/tasks/components/TaskFilterBar';
import { TASK_SCOPE_OPTIONS } from '@/app/features/tasks/pages/Tasks/taskScopeOptions';
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

    // Audience pills. "Staff", not "Team": the assignee SCOPE control beside these
    // is "My tasks | Team", so an audience chip called "Team" put two adjacent
    // buttons with the same label in one toolbar.
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pet parents' })).toBeInTheDocument();

    // Inline status pills — the "All" status is dropped from the row.
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
    /* The status filters are the shared FilterChip now, not ALL-CAPS StatusPills
       wrapped in buttons. FilterChip's own doc says it replaced exactly that
       pattern for Templates and Finance, "which made a filter row read as a row
       of statuses"; the task board was the one that had not moved. Sentence
       case, the 32px chip geometry, and the status colour surviving as the
       chip's leading dot. */
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveClass(
      'h-8',
      'px-[13px]',
      'text-[12.5px]'
    );
    expect(screen.queryByTitle('Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('All statuses')).not.toBeInTheDocument();
  });

  it('toggles the audience filter and back to all', () => {
    const { rerender } = renderBar({ activeFilter: 'all' });
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }));
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
    expect(screen.getByRole('button', { name: 'Staff' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'In progress' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('never labels an audience chip the same as an assignee-scope option', () => {
    // The toolbar renders both, side by side, and they mean different things:
    // scope is WHOSE tasks, audience is who the task is FOR. They both said
    // "Team", so the row read "My tasks - Team - All - Team - Pet parents".
    // Separating them by shape alone was not enough.
    const scopeNames = new Set(TASK_SCOPE_OPTIONS.map((o) => o.name.toLowerCase()));
    const collisions = TaskFilters.filter((f) => scopeNames.has(f.name.toLowerCase())).map(
      (f) => f.name
    );

    expect(collisions).toEqual([]);
  });

  it('gives the selected status filter a visible fill, not just aria-pressed', () => {
    /* The selected state used to be the ABSENCE of an opacity-65 dim on the
       other pills, which composited their labels below AA. That was replaced by
       a ring, and now by the shared chip's solid fill. aria-pressed alone is
       invisible to a sighted user, so whatever the affordance is has to be
       asserted - otherwise deleting it leaves this file green. */
    renderBar({ activeStatus: 'in_progress' });

    const active = screen.getByRole('button', { name: 'In progress' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active.className).toContain('bg-[var(--chip-selected-bg)]');

    const inactive = screen.getByRole('button', { name: 'Completed' });
    expect(inactive).toHaveAttribute('aria-pressed', 'false');
    expect(inactive.className).not.toContain('bg-[var(--chip-selected-bg)]');
    // ...and no chip is dimmed to make the selection legible.
    expect(inactive.className).not.toMatch(/opacity-/);
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

  it('renders the assignee scope segmented control and toggles it', () => {
    const setActiveScope = jest.fn();
    renderBar({
      scopeOptions: [
        { key: 'mine', name: 'My tasks' },
        { key: 'team', name: 'Team' },
      ],
      activeScope: 'team',
      setActiveScope,
    });

    // The scope group is its own labelled region so its "Team" segment does not
    // collide with the "Team" audience chip.
    const scope = within(screen.getByRole('group', { name: 'Task scope' }));
    const teamScope = scope.getByRole('button', { name: 'Team' });
    const mineScope = scope.getByRole('button', { name: 'My tasks' });

    expect(teamScope).toHaveAttribute('aria-pressed', 'true');
    expect(mineScope).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mineScope);
    expect(setActiveScope).toHaveBeenCalledWith('mine');
  });

  it("carries the status's own colour as the chip's dot", () => {
    // The status colour is not lost in the move to a chip: it becomes the
    // leading dot, so Pending and Completed still read apart at a glance.
    renderBar({
      statusOptions: [{ key: 'pending', name: 'Pending', bg: '#eeeeee', text: '#111111' }],
      activeStatus: 'pending',
    });
    const button = screen.getByRole('button', { name: 'Pending' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    const dot = button.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveStyle({ backgroundColor: '#111111' });
  });

  it('hides the scope control when scope options are not supplied', () => {
    const { unmount } = renderBar({
      scopeOptions: [],
      activeScope: 'team',
      setActiveScope: jest.fn(),
    });
    expect(screen.queryByRole('group', { name: 'Task scope' })).not.toBeInTheDocument();
    unmount();

    // Options present but no handler wired: the control still stays hidden.
    renderBar({ scopeOptions: [{ key: 'mine', name: 'My tasks' }], activeScope: 'mine' });
    expect(screen.queryByRole('group', { name: 'Task scope' })).not.toBeInTheDocument();
  });
});
