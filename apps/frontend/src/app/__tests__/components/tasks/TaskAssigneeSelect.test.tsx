import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import TaskAssigneeSelect from '@/app/features/tasks/components/TaskAssigneeSelect';

describe('TaskAssigneeSelect', () => {
  const teamOptions = [
    { value: 'u1', label: 'Dr Brunner' },
    { value: 'u2', label: 'Elif Kaya' },
  ];
  const parentOptions = [{ value: 'p1', label: 'Amelia' }];
  const onSelectTeam = jest.fn();
  const onSelectParent = jest.fn();

  const renderSelect = (overrides: Partial<React.ComponentProps<typeof TaskAssigneeSelect>> = {}) =>
    render(
      <TaskAssigneeSelect
        teamOptions={teamOptions}
        parentOptions={parentOptions}
        audience="EMPLOYEE_TASK"
        assignedTo=""
        onSelectTeam={onSelectTeam}
        onSelectParent={onSelectParent}
        {...overrides}
      />
    );

  const openDropdown = () => fireEvent.click(screen.getByRole('button', { name: /Assign to/i }));

  beforeEach(() => jest.clearAllMocks());

  it('renders a single trigger, not one control per assignee', () => {
    renderSelect();
    expect(screen.getByText('Assign to')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('groups staff and pet parents under their own headers when opened', () => {
    renderSelect();
    openDropdown();

    const listbox = screen.getByRole('listbox');
    const staffGroup = within(listbox).getByText('Staff').closest('fieldset') as HTMLElement;
    expect(within(staffGroup).getByText('Dr Brunner')).toBeInTheDocument();
    expect(within(staffGroup).getByText('Elif Kaya')).toBeInTheDocument();

    const parentGroup = within(listbox).getByText('Pet parents').closest('fieldset') as HTMLElement;
    expect(within(parentGroup).getByText('Amelia')).toBeInTheDocument();
    // A hundred staff still search instead of piling up as unscrollable pills.
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
  });

  it('filters both groups by the same search query', () => {
    renderSelect();
    openDropdown();
    fireEvent.change(screen.getByLabelText('Search staff or pet parents'), {
      target: { value: 'ame' },
    });

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByText('Dr Brunner')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Staff')).not.toBeInTheDocument();
    expect(within(listbox).getByText('Amelia')).toBeInTheDocument();
  });

  it('shows "No matches found" when the query matches nobody', () => {
    renderSelect();
    openDropdown();
    fireEvent.change(screen.getByLabelText('Search staff or pet parents'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No matches found')).toBeInTheDocument();
  });

  it('calls onSelectTeam and closes when a staff row is picked', () => {
    renderSelect();
    openDropdown();
    fireEvent.click(screen.getByText('Elif Kaya'));

    expect(onSelectTeam).toHaveBeenCalledWith(expect.objectContaining({ value: 'u2' }));
    expect(onSelectParent).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls onSelectParent and closes when a pet-parent row is picked', () => {
    renderSelect();
    openDropdown();
    fireEvent.click(screen.getByText('Amelia'));

    expect(onSelectParent).toHaveBeenCalledWith(expect.objectContaining({ value: 'p1' }));
    expect(onSelectTeam).not.toHaveBeenCalled();
  });

  it('shows the selected staff member on the trigger for an employee task', () => {
    renderSelect({ audience: 'EMPLOYEE_TASK', assignedTo: 'u1' });
    expect(screen.getByRole('button', { name: /Assign to: Dr Brunner/ })).toBeInTheDocument();
  });

  it('shows the selected pet parent on the trigger for a parent task', () => {
    renderSelect({ audience: 'PARENT_TASK', assignedTo: 'p1' });
    expect(
      screen.getByRole('button', { name: /Assign to: Amelia \(pet parent\)/ })
    ).toBeInTheDocument();
  });

  it('does not cross-match a shared id across audiences', () => {
    // Same id in both lists; only the list matching `audience` may resolve it.
    renderSelect({
      teamOptions: [{ value: 'shared', label: 'Dr Elena Marsh' }],
      parentOptions: [{ value: 'shared', label: 'Marta Alvarez' }],
      audience: 'PARENT_TASK',
      assignedTo: 'shared',
    });
    expect(
      screen.getByRole('button', { name: /Assign to: Marta Alvarez \(pet parent\)/ })
    ).toBeInTheDocument();
  });

  it('renders an error message tied to the trigger', () => {
    renderSelect({ error: 'Pick an assignee' });
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Pick an assignee');
    expect(screen.getByRole('button', { name: /Assign to/i })).toHaveAttribute(
      'aria-describedby',
      error.id
    );
  });

  it('shows an empty state and no trigger when there are no assignees', () => {
    renderSelect({ teamOptions: [], parentOptions: [] });
    expect(screen.getByText('No assignees available yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('handles missing handlers without crashing', () => {
    render(
      <TaskAssigneeSelect
        teamOptions={teamOptions}
        parentOptions={parentOptions}
        audience="EMPLOYEE_TASK"
        assignedTo=""
      />
    );
    openDropdown();
    fireEvent.click(screen.getByText('Dr Brunner'));
    // No throw — optional handlers are safely no-ops, and the trigger survives.
    expect(screen.getByRole('button', { name: /Assign to/i })).toBeInTheDocument();
  });

  it('selects with arrow keys and enter across both groups', () => {
    renderSelect();
    const trigger = screen.getByRole('button', { name: /Assign to/i });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // opens, seeds Dr Brunner active
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // Elif Kaya
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // Amelia
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onSelectParent).toHaveBeenCalledWith(expect.objectContaining({ value: 'p1' }));
  });
});
