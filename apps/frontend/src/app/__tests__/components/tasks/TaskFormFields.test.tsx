import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect }: any) => (
    <div>
      <div>{placeholder}</div>
      {options.map((option: any) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option)}
          aria-label={`${placeholder}:${option.label}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/inputs/FormDesc/FormDesc', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea aria-label="description" value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <input aria-label={inlabel} value={value} onChange={onChange} />
  ),
}));

jest.mock('@/app/ui/inputs/Datepicker', () => ({
  __esModule: true,
  default: ({ setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date('2026-01-01T00:00:00.000Z'))}>
      set-due
    </button>
  ),
}));

jest.mock('@/app/ui/inputs/Timepicker', () => ({
  __esModule: true,
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('09:30')}>
      set-time
    </button>
  ),
}));

describe('TaskFormFields', () => {
  const setFormData = jest.fn();
  const setDue = jest.fn();
  const setDueTimeValue = jest.fn();
  const onSelectTemplate = jest.fn();

  const baseFormData: any = {
    source: 'CUSTOM',
    audience: 'EMPLOYEE_TASK',
    assignedTo: '',
    category: 'CARE',
    name: 'Task A',
    description: 'Desc',
    recurrence: { type: 'ONCE' },
  };

  const renderFields = (overrides: any = {}) =>
    render(
      <TaskFormFields
        formData={{ ...baseFormData, ...overrides }}
        setFormData={setFormData}
        formDataErrors={{} as any}
        templateOptions={[{ value: 'tpl-1', label: 'Template 1' } as any]}
        due={null}
        setDue={setDue}
        dueTimeValue=""
        setDueTimeValue={setDueTimeValue}
        onSelectTemplate={onSelectTemplate}
        showAudienceSelect={true}
        audienceOptions={[{ value: 'EMPLOYEE_TASK', label: 'Employee task' } as any]}
        onAudienceSelect={jest.fn()}
        showAssigneeSelect={true}
        assigneeOptions={[{ value: 'user-1', label: 'User 1' } as any]}
        onAssigneeSelect={jest.fn()}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the canonical field set (no Source field) and updates title/description', () => {
    renderFields();

    // The old "Source" dropdown is gone; the canonical fields are present.
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Reminder (optional)')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Updated task' } });
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'Updated desc' } });
    fireEvent.click(screen.getByRole('button', { name: 'set-due' }));
    fireEvent.click(screen.getByRole('button', { name: 'set-time' }));

    expect(setFormData).toHaveBeenCalled();
    expect(setDue).toHaveBeenCalled();
    expect(setDueTimeValue).toHaveBeenCalledWith('09:30');
  });

  it('loads from a template via the template picker', () => {
    renderFields();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load from template (optional):Template 1' })
    );

    expect(onSelectTemplate).toHaveBeenCalledWith('tpl-1');
  });

  it('maps the reminder dropdown to an offset and clears it on "No reminder"', () => {
    renderFields();

    fireEvent.click(screen.getByRole('button', { name: 'Reminder (optional):15 minutes before' }));
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ reminder: { enabled: true, offsetMinutes: 15 } })
    );

    setFormData.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reminder (optional):No reminder' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ reminder: undefined }));
  });

  it('maps the repeat dropdown to a recurrence (interval -> CUSTOM + cron)', () => {
    renderFields();

    fireEvent.click(screen.getByRole('button', { name: 'Repeat:Every 6 hours' }));
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: expect.objectContaining({
          type: 'CUSTOM',
          cronExpression: '0 */6 * * *',
          isMaster: true,
        }),
      })
    );
  });

  it('updates the category from the canonical list', () => {
    renderFields();

    fireEvent.click(screen.getByRole('button', { name: 'Category:Billing' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ category: 'BILLING' }));
  });

  it('renders the priority picker and updates the priority from the canonical list', () => {
    renderFields();

    expect(screen.getByText('Priority')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Priority:Urgent' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ priority: 'URGENT' }));
  });

  it('renders the centered-dialog two-column layout with grouped grid rows', () => {
    const { container } = render(
      <TaskFormFields
        formData={{ ...baseFormData }}
        setFormData={setFormData}
        formDataErrors={{} as any}
        templateOptions={[{ value: 'tpl-1', label: 'Template 1' } as any]}
        due={null}
        setDue={setDue}
        dueTimeValue=""
        setDueTimeValue={setDueTimeValue}
        onSelectTemplate={onSelectTemplate}
        showAudienceSelect={true}
        audienceOptions={[{ value: 'EMPLOYEE_TASK', label: 'Employee task' } as any]}
        onAudienceSelect={jest.fn()}
        showAssigneeSelect={true}
        assigneeOptions={[{ value: 'user-1', label: 'User 1' } as any]}
        onAssigneeSelect={jest.fn()}
        twoColumn
      />
    );

    // Category + assignee share one grid row; Due date + Time + Repeat share another.
    expect(container.querySelectorAll('div.grid')).toHaveLength(2);
    // Fields stay wired up in the gridded layout.
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category:Billing' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ category: 'BILLING' }));
  });

  it('shows the end-date field for a recurring task and updates the recurrence end date', () => {
    renderFields({ recurrence: { type: 'DAILY', isMaster: true } });

    // A recurring task renders a second date picker (due + end date).
    const dateButtons = screen.getAllByRole('button', { name: 'set-due' });
    expect(dateButtons.length).toBeGreaterThan(1);
    fireEvent.click(dateButtons[dateButtons.length - 1]);

    // setEndDate delegates to setFormData with an updater; exercise both the
    // "has recurrence" and the fallback branches to cover the updater body.
    const updater = setFormData.mock.calls.at(-1)?.[0];
    const withRecurrence = updater({ recurrence: { type: 'DAILY', isMaster: true } });
    expect(withRecurrence.recurrence.endDate).toBeInstanceOf(Date);
    const withoutRecurrence = updater({});
    expect(withoutRecurrence.recurrence.endDate).toBeInstanceOf(Date);
  });

  it('renders the "Assign to" chip row in the new-task (assigneeChips) layout', () => {
    const onSelectTeam = jest.fn();
    const onSelectParent = jest.fn();
    render(
      <TaskFormFields
        formData={{ ...baseFormData }}
        setFormData={setFormData}
        formDataErrors={{} as any}
        templateOptions={[{ value: 'tpl-1', label: 'Template 1' } as any]}
        due={null}
        setDue={setDue}
        dueTimeValue=""
        setDueTimeValue={setDueTimeValue}
        onSelectTemplate={onSelectTemplate}
        twoColumn
        assigneeChips
        teamOptions={[{ value: 'u1', label: 'Dr Brunner' } as any]}
        parentOptions={[{ value: 'p1', label: 'Amelia' } as any]}
        onSelectTeam={onSelectTeam}
        onSelectParent={onSelectParent}
      />
    );

    // The audience Type dropdown is gone; the chip row is present instead.
    expect(screen.queryByText('Type')).not.toBeInTheDocument();
    expect(screen.getByText('Assign to')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dr Brunner/ }));
    expect(onSelectTeam).toHaveBeenCalledWith(expect.objectContaining({ value: 'u1' }));

    fireEvent.click(screen.getByRole('button', { name: /Pet parent · Amelia/ }));
    expect(onSelectParent).toHaveBeenCalledWith(expect.objectContaining({ value: 'p1' }));

    // Core fields still render and stay wired.
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category:Billing' }));
    expect(setFormData).toHaveBeenCalledWith(expect.objectContaining({ category: 'BILLING' }));
  });
});
