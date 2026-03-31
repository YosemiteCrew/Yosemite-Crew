import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';

jest.mock('@/app/ui/inputs/Dropdown/LabelDropdown', () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect }: any) => (
    <div>
      <div>{placeholder}</div>
      {options.map((option: any) => (
        <button key={option.value} type="button" onClick={() => onSelect(option)}>
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

jest.mock('@/app/ui/inputs/SelectLabel', () => ({
  __esModule: true,
  default: ({ setOption }: any) => (
    <button type="button" onClick={() => setOption('DAILY')}>
      set-recurrence
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
    audience: 'ALL',
    assignedTo: '',
    category: 'CUSTOM',
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
        audienceOptions={[{ value: 'ALL', label: 'All' } as any]}
        onAudienceSelect={jest.fn()}
        showAssigneeSelect={true}
        assigneeOptions={[{ value: 'user-1', label: 'User 1' } as any]}
        onAssigneeSelect={jest.fn()}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles source/template/category/name/description/reminder updates', () => {
    renderFields({ source: 'YC_LIBRARY' });

    fireEvent.click(screen.getByRole('button', { name: 'YC Library' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Template 1' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Custom' })[0]);

    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Updated task' } });
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'Updated desc' } });
    fireEvent.change(screen.getByLabelText('Reminder (in minutes)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Reminder (in minutes)'), { target: { value: '15' } });

    fireEvent.click(screen.getByRole('button', { name: 'set-due' }));
    fireEvent.click(screen.getByRole('button', { name: 'set-recurrence' }));

    expect(setFormData).toHaveBeenCalled();
    expect(onSelectTemplate).toHaveBeenCalledWith('tpl-1');
    expect(setDue).toHaveBeenCalled();
  });

  it('handles org template path and ignores zero reminder', () => {
    renderFields({ source: 'ORG_TEMPLATE' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Template 1' })[0]);
    fireEvent.change(screen.getByLabelText('Reminder (in minutes)'), { target: { value: '0' } });

    const calls = (setFormData as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calls.some((arg) => typeof arg === 'object' && arg.templateId === 'tpl-1')).toBe(true);
    expect(calls.some((arg) => typeof arg === 'object' && arg.reminder?.offsetMinutes === 0)).toBe(
      false
    );
  });
});
