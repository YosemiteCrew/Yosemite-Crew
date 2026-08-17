import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveClass(
      'min-h-[38px]',
      'px-1',
      'py-1'
    );
    expect(screen.getByTitle('Pending')).toHaveClass('text-[10px]', 'uppercase');
    expect(screen.getByTitle('Pending')).toHaveStyle({
      backgroundColor: 'var(--color-pill-neutral-bg)',
    });
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

  it('gives the selected status pill a visible ring, not just aria-pressed', () => {
    // The selected state used to be the ABSENCE of an opacity-65 dim on the
    // other pills, which composited their labels below AA. aria-pressed alone
    // is invisible to a sighted user, so the ring is the actual affordance and
    // has to be asserted - otherwise deleting it leaves this file green.
    renderBar({ activeStatus: 'in_progress' });

    const active = screen.getByRole('button', { name: 'In progress' });
    expect(active.className).toContain('ring-2');
    expect(active.className).toContain('ring-[var(--blue-strong)]');
    expect(active.className).toContain('ring-offset-[var(--screen)]');

    const inactive = screen.getByRole('button', { name: 'Completed' });
    expect(inactive.className).not.toContain('ring-2 ring-[var(--blue-strong)]');
    // ...and no pill is dimmed to make the selection legible.
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

  it('falls back to the pill fill for the active border when none is provided', () => {
    renderBar({
      statusOptions: [{ key: 'pending', name: 'Pending', bg: '#eeeeee', text: '#111111' }],
      activeStatus: 'pending',
    });
    const button = screen.getByRole('button', { name: 'Pending' });
    const pill = screen.getByTitle('Pending');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(pill).toHaveStyle({ borderColor: '#eeeeee' });
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
