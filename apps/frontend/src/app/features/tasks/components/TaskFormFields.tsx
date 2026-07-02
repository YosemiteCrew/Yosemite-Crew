import React from 'react';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { Option } from '@/app/features/companions/types/companion';
import { Task, TaskKindOptions } from '@/app/features/tasks/types/task';
import { TaskFormErrors } from '@/app/lib/taskForm';
import {
  offsetToReminderValue,
  recurrenceToRepeatValue,
  reminderValueToOffset,
  repeatValueToRecurrence,
  TASK_REMINDER_OPTIONS,
  TASK_REPEAT_OPTIONS,
} from '@/app/features/tasks/constants/taskTaxonomy';

type TaskFormFieldsProps = {
  formData: Task;
  setFormData: React.Dispatch<React.SetStateAction<Task>>;
  formDataErrors: TaskFormErrors;
  /** Selectable templates to prefill the form (org templates + YC library). */
  templateOptions: Option[];
  due: Date | null;
  setDue: React.Dispatch<React.SetStateAction<Date | null>>;
  dueTimeValue: string;
  setDueTimeValue: React.Dispatch<React.SetStateAction<string>>;
  /** Apply a selected template to the form (prefills title/category/etc.). */
  onSelectTemplate: (templateId: string) => void;
  showAudienceSelect?: boolean;
  audienceOptions?: Option[];
  onAudienceSelect?: (option: Option) => void;
  showAssigneeSelect?: boolean;
  assigneeOptions?: Option[];
  onAssigneeSelect?: (option: Option) => void;
  /** Hide the "Load from template" picker (e.g. when editing an existing task). */
  hideTemplatePicker?: boolean;
};

const DEFAULT_AUDIENCE_OPTIONS: Option[] = [];
const DEFAULT_ASSIGNEE_OPTIONS: Option[] = [];

const TaskFormFields = ({
  formData,
  setFormData,
  formDataErrors,
  templateOptions,
  due,
  setDue,
  dueTimeValue,
  setDueTimeValue,
  onSelectTemplate,
  showAudienceSelect = false,
  audienceOptions = DEFAULT_AUDIENCE_OPTIONS,
  onAudienceSelect,
  showAssigneeSelect = false,
  assigneeOptions = DEFAULT_ASSIGNEE_OPTIONS,
  onAssigneeSelect,
  hideTemplatePicker = false,
}: TaskFormFieldsProps) => {
  const isRecurring = (formData.recurrence?.type ?? 'ONCE') !== 'ONCE';
  const endDate = formData.recurrence?.endDate ? new Date(formData.recurrence.endDate) : null;
  const setEndDate = (next: Date | null) =>
    setFormData((prev) => ({
      ...prev,
      recurrence: {
        ...(prev.recurrence ?? { type: 'ONCE', isMaster: false }),
        endDate: next ?? undefined,
      },
    }));

  return (
    <div className="flex flex-col gap-3">
      {showAudienceSelect && (
        <LabelDropdown
          placeholder="Type"
          onSelect={(option) => onAudienceSelect?.(option)}
          defaultOption={formData.audience}
          options={audienceOptions}
          searchable={false}
        />
      )}
      {showAssigneeSelect && (
        <LabelDropdown
          placeholder="Assigned to"
          onSelect={(option) => onAssigneeSelect?.(option)}
          defaultOption={formData.assignedTo}
          error={formDataErrors.assignedTo}
          options={assigneeOptions}
        />
      )}
      {!hideTemplatePicker && templateOptions.length > 0 && (
        <LabelDropdown
          placeholder="Load from template (optional)"
          onSelect={(option) => onSelectTemplate(option.value)}
          defaultOption={formData.templateId || formData.libraryTaskId}
          options={templateOptions}
          noOptionsMessage="No templates available"
        />
      )}
      <LabelDropdown
        placeholder="Category"
        onSelect={(option) =>
          setFormData({
            ...formData,
            category: option.value,
          })
        }
        defaultOption={formData.category}
        options={TaskKindOptions}
        error={formDataErrors.category}
        searchable={false}
      />
      <FormInput
        intype="text"
        inname="task"
        value={formData.name}
        inlabel="Task title"
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        error={formDataErrors.name}
      />
      <FormDesc
        intype="text"
        inname="description"
        value={formData.description || ''}
        inlabel="Instructions (optional)"
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        className="min-h-30!"
      />
      <Datepicker
        currentDate={due}
        setCurrentDate={setDue}
        placeholder="Due date"
        type="input"
        error={formDataErrors.dueAt}
      />
      <Timepicker
        value={dueTimeValue}
        label="Due time"
        name="dueTime"
        onChange={setDueTimeValue}
        error={formDataErrors.dueAt}
      />
      <LabelDropdown
        placeholder="Reminder (optional)"
        onSelect={(option) => {
          const offsetMinutes = reminderValueToOffset(option.value);
          setFormData({
            ...formData,
            reminder: offsetMinutes ? { enabled: true, offsetMinutes } : undefined,
          });
        }}
        defaultOption={offsetToReminderValue(formData.reminder?.offsetMinutes)}
        options={TASK_REMINDER_OPTIONS}
        error={formDataErrors.reminder}
        searchable={false}
      />
      <LabelDropdown
        placeholder="Repeat"
        onSelect={(option) => {
          const { type, cronExpression } = repeatValueToRecurrence(option.value);
          setFormData({
            ...formData,
            recurrence: {
              ...formData.recurrence,
              type,
              cronExpression,
              isMaster: type !== 'ONCE',
              // A one-off task has no end boundary; clear any prior end date.
              endDate: type === 'ONCE' ? undefined : formData.recurrence?.endDate,
            },
          });
        }}
        defaultOption={recurrenceToRepeatValue(formData.recurrence)}
        options={TASK_REPEAT_OPTIONS}
        searchable={false}
      />
      {/* Recurring tasks need an end boundary; a one-off task only has the due date. */}
      {isRecurring && (
        <Datepicker
          currentDate={endDate}
          setCurrentDate={
            ((next: Date | null) => setEndDate(next)) as React.Dispatch<
              React.SetStateAction<Date | null>
            >
          }
          placeholder="End date"
          type="input"
          minDate={due ?? undefined}
          error={formDataErrors.endDate}
        />
      )}
    </div>
  );
};

export default TaskFormFields;
