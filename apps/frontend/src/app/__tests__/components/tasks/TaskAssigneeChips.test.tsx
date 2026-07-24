import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskAssigneeChips from '@/app/features/tasks/components/TaskAssigneeChips';

describe('TaskAssigneeChips', () => {
  const teamOptions = [
    { value: 'u1', label: 'Dr Brunner' },
    { value: 'u2', label: 'Elif Kaya' },
  ];
  const parentOptions = [{ value: 'p1', label: 'Amelia' }];
  const onSelectTeam = jest.fn();
  const onSelectParent = jest.fn();

  const renderChips = (overrides: Partial<React.ComponentProps<typeof TaskAssigneeChips>> = {}) =>
    render(
      <TaskAssigneeChips
        teamOptions={teamOptions}
        parentOptions={parentOptions}
        audience="EMPLOYEE_TASK"
        assignedTo=""
        onSelectTeam={onSelectTeam}
        onSelectParent={onSelectParent}
        {...overrides}
      />
    );

  beforeEach(() => jest.clearAllMocks());

  it('renders team chips and a pet-parent chip', () => {
    renderChips();
    expect(screen.getByRole('button', { name: /Dr Brunner/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Elif Kaya/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pet parent · Amelia/ })).toBeInTheDocument();
  });

  it('marks the selected team member active only for an employee task', () => {
    renderChips({ audience: 'EMPLOYEE_TASK', assignedTo: 'u1' });
    expect(screen.getByRole('button', { name: /Dr Brunner/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /Elif Kaya/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /Pet parent · Amelia/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('marks the pet-parent chip active only for a parent task', () => {
    renderChips({ audience: 'PARENT_TASK', assignedTo: 'p1' });
    expect(screen.getByRole('button', { name: /Pet parent · Amelia/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // The same id under an employee audience would not mark the team chip.
    expect(screen.getByRole('button', { name: /Dr Brunner/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('invokes the right handler when a chip is picked', () => {
    renderChips();
    fireEvent.click(screen.getByRole('button', { name: /Elif Kaya/ }));
    expect(onSelectTeam).toHaveBeenCalledWith(expect.objectContaining({ value: 'u2' }));

    fireEvent.click(screen.getByRole('button', { name: /Pet parent · Amelia/ }));
    expect(onSelectParent).toHaveBeenCalledWith(expect.objectContaining({ value: 'p1' }));
  });

  it('renders an error message when provided', () => {
    renderChips({ error: 'Pick an assignee' });
    expect(screen.getByText('Pick an assignee')).toBeInTheDocument();
  });

  it('shows an empty state when there are no assignees', () => {
    renderChips({ teamOptions: [], parentOptions: [] });
    expect(screen.getByText('No assignees available yet.')).toBeInTheDocument();
  });

  it('handles missing handlers without crashing', () => {
    render(
      <TaskAssigneeChips
        teamOptions={teamOptions}
        parentOptions={parentOptions}
        audience="EMPLOYEE_TASK"
        assignedTo=""
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Dr Brunner/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pet parent · Amelia/ }));
    // No throw — optional handlers are safely no-ops.
    expect(screen.getByRole('button', { name: /Dr Brunner/ })).toBeInTheDocument();
  });
});
