import React from 'react';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { Option } from '@/app/features/companions/types/companion';
import { Task, TaskKindOptions, TaskPriorityOptions } from '@/app/features/tasks/types/task';
import TaskAssigneeChips from '@/app/features/tasks/components/TaskAssigneeChips';
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
  /**
   * Opt into the centered-dialog grid: Category + assignee share a 2-col row and
   * Due date / Time / Repeat share a 3-col row (per the New task design). Defaults
   * to the single-column stack every other consumer (side panels) already uses.
   */
  twoColumn?: boolean;
  /**
   * Render the design's "Assign to" chip row (team members + pet-parent chips) in
   * place of the audience Type + assignee dropdowns. Only used by the New task
   * modal (twoColumn); side-panel consumers keep the dropdowns.
   */
  assigneeChips?: boolean;
  teamOptions?: Option[];
  parentOptions?: Option[];
  onSelectTeam?: (option: Option) => void;
  onSelectParent?: (option: Option) => void;
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
  twoColumn = false,
  assigneeChips = false,
  teamOptions = DEFAULT_ASSIGNEE_OPTIONS,
  parentOptions = DEFAULT_ASSIGNEE_OPTIONS,
  onSelectTeam,
  onSelectParent,
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

  const audienceField = showAudienceSelect ? (
    <LabelDropdown
      placeholder="Type"
      onSelect={(option) => onAudienceSelect?.(option)}
      defaultOption={formData.audience}
      options={audienceOptions}
      searchable={false}
    />
  ) : null;

  const assigneeField = showAssigneeSelect ? (
    <LabelDropdown
      placeholder="Assigned to"
      onSelect={(option) => onAssigneeSelect?.(option)}
      defaultOption={formData.assignedTo}
      error={formDataErrors.assignedTo}
      options={assigneeOptions}
    />
  ) : null;

  const assignToChips = assigneeChips ? (
    <TaskAssigneeChips
      teamOptions={teamOptions}
      parentOptions={parentOptions}
      audience={formData.audience}
      assignedTo={formData.assignedTo}
      onSelectTeam={(option) => onSelectTeam?.(option)}
      onSelectParent={(option) => onSelectParent?.(option)}
      error={formDataErrors.assignedTo}
    />
  ) : null;

  const templateField =
    !hideTemplatePicker && templateOptions.length > 0 ? (
      <LabelDropdown
        placeholder="Load from template (optional)"
        onSelect={(option) => onSelectTemplate(option.value)}
        defaultOption={formData.templateId || formData.libraryTaskId}
        options={templateOptions}
        noOptionsMessage="No templates available"
      />
    ) : null;

  const categoryField = (
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
  );

  const priorityField = (
    <LabelDropdown
      placeholder="Priority"
      onSelect={(option) =>
        setFormData({
          ...formData,
          priority: option.value as Task['priority'],
        })
      }
      defaultOption={formData.priority}
      options={TaskPriorityOptions}
      searchable={false}
    />
  );

  const taskField = (
    <FormInput
      intype="text"
      inname="task"
      value={formData.name}
      inlabel="Task"
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      error={formDataErrors.name}
    />
  );

  const instructionsField = (
    <FormDesc
      intype="text"
      inname="description"
      value={formData.description || ''}
      inlabel="Instructions (optional)"
      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      className="min-h-30!"
    />
  );

  const dueField = (
    <Datepicker
      currentDate={due}
      setCurrentDate={setDue}
      placeholder="Due date"
      type="input"
      error={formDataErrors.dueAt}
    />
  );

  const timeField = (
    <Timepicker
      value={dueTimeValue}
      label="Time"
      name="dueTime"
      onChange={setDueTimeValue}
      error={formDataErrors.dueAt}
    />
  );

  const reminderField = (
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
  );

  const repeatField = (
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
  );

  // Recurring tasks need an end boundary; a one-off task only has the due date.
  const endDateField = isRecurring ? (
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
  ) : null;

  // Centered-dialog layout (New task modal): grouped grids matching the design.
  // Task, then Category, then the "Assign to" chip row, then Due/Time/Repeat,
  // with the secondary Priority/Reminder controls demoted below the core fields.
  if (twoColumn && assigneeChips) {
    return (
      <div className="flex flex-col gap-3.5">
        {templateField}
        {taskField}
        {categoryField}
        {assignToChips}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {dueField}
          {timeField}
          {repeatField}
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {priorityField}
          {reminderField}
        </div>
        {endDateField}
        {instructionsField}
      </div>
    );
  }

  if (twoColumn) {
    return (
      <div className="flex flex-col gap-3.5">
        {audienceField}
        {templateField}
        {taskField}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {categoryField}
          {assigneeField}
        </div>
        {priorityField}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {dueField}
          {timeField}
          {repeatField}
        </div>
        {reminderField}
        {endDateField}
        {instructionsField}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {audienceField}
      {assigneeField}
      {templateField}
      {categoryField}
      {priorityField}
      {taskField}
      {instructionsField}
      {dueField}
      {timeField}
      {reminderField}
      {repeatField}
      {endDateField}
    </div>
  );
};

export default TaskFormFields;
