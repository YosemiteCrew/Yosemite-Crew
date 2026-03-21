import React from 'react';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SelectLabel from '@/app/ui/inputs/SelectLabel';
import { Option } from '@/app/features/companions/types/companion';
import { Task, TaskKindOptions, TaskRecurrenceOptions } from '@/app/features/tasks/types/task';
import { TaskFormErrors } from '@/app/lib/taskForm';

const TaskSourceOptions = [
  { value: 'YC_LIBRARY', label: 'YC Library' },
  { value: 'ORG_TEMPLATE', label: 'Org Template' },
  { value: 'CUSTOM', label: 'Custom' },
];

type TaskFormFieldsProps = {
  formData: Task;
  setFormData: React.Dispatch<React.SetStateAction<Task>>;
  formDataErrors: TaskFormErrors;
  templateOptions: Option[];
  due: Date | null;
  setDue: React.Dispatch<React.SetStateAction<Date | null>>;
  dueTimeValue: string;
  setDueTimeValue: React.Dispatch<React.SetStateAction<string>>;
  onSelectTemplate: (templateId: string) => void;
  showAudienceSelect?: boolean;
  audienceOptions?: Option[];
  onAudienceSelect?: (option: Option) => void;
  showAssigneeSelect?: boolean;
  assigneeOptions?: Option[];
  onAssigneeSelect?: (option: Option) => void;
};

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
  audienceOptions = [],
  onAudienceSelect,
  showAssigneeSelect = false,
  assigneeOptions = [],
  onAssigneeSelect,
}: TaskFormFieldsProps) => (
  <div className="flex flex-col gap-3">
    {showAudienceSelect && (
      <LabelDropdown
        placeholder="Type"
        onSelect={(option) => onAudienceSelect?.(option)}
        defaultOption={formData.audience}
        options={audienceOptions}
      />
    )}
    {showAssigneeSelect && (
      <LabelDropdown
        placeholder="To"
        onSelect={(option) => onAssigneeSelect?.(option)}
        defaultOption={formData.assignedTo}
        error={formDataErrors.assignedTo}
        options={assigneeOptions}
      />
    )}
    <LabelDropdown
      placeholder="Source"
      onSelect={(option) => {
        setFormData({
          ...formData,
          source: option.value as any,
          templateId: undefined,
          libraryTaskId: undefined,
          name: '',
          description: '',
          category: 'CUSTOM',
        });
      }}
      defaultOption={formData.source}
      options={TaskSourceOptions}
    />
    {formData.source === 'YC_LIBRARY' && (
      <LabelDropdown
        placeholder={'Template'}
        onSelect={(option) => {
          setFormData({
            ...formData,
            libraryTaskId: option.value,
          });
          onSelectTemplate(option.value);
        }}
        defaultOption={formData.libraryTaskId}
        options={templateOptions}
        error={formDataErrors.libraryTaskId}
      />
    )}
    {formData.source === 'ORG_TEMPLATE' && (
      <LabelDropdown
        placeholder={'Template'}
        onSelect={(option) => {
          setFormData({
            ...formData,
            templateId: option.value,
          });
          onSelectTemplate(option.value);
        }}
        defaultOption={formData.templateId}
        options={templateOptions}
        error={formDataErrors.templateId}
      />
    )}
    <LabelDropdown
      placeholder={'Category'}
      onSelect={(option) =>
        setFormData({
          ...formData,
          category: option.value,
        })
      }
      defaultOption={formData.category}
      options={TaskKindOptions}
      error={formDataErrors.category}
    />
    <FormInput
      intype="text"
      inname="task"
      value={formData.name}
      inlabel="Task"
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      error={formDataErrors.name}
    />
    <FormDesc
      intype="text"
      inname="description"
      value={formData.description || ''}
      inlabel="Description (optional)"
      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      className="min-h-[120px]!"
    />
    <Datepicker
      currentDate={due}
      setCurrentDate={setDue}
      placeholder="Due date"
      type="input"
      error={formDataErrors.dueAt}
    />
    <FormInput
      intype="time"
      inname="dueTime"
      value={dueTimeValue}
      inlabel="Due time"
      onChange={(e) => setDueTimeValue(e.target.value)}
      error={formDataErrors.dueAt}
    />
    <FormInput
      intype="number"
      inname="reminder"
      value={
        typeof formData.reminder?.offsetMinutes === 'number'
          ? String(formData.reminder.offsetMinutes)
          : ''
      }
      inlabel="Reminder (in minutes)"
      error={formDataErrors.reminder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setFormData({
            ...formData,
            reminder: undefined,
          });
          return;
        }
        const value = Number.parseInt(raw, 10);
        if (!Number.isFinite(value) || value === 0) return;
        setFormData({
          ...formData,
          reminder: {
            enabled: true,
            offsetMinutes: value,
          },
        });
      }}
    />
    <SelectLabel
      title="Reoccurrence"
      options={TaskRecurrenceOptions}
      activeOption={formData.recurrence?.type || 'ONCE'}
      setOption={(value) =>
        setFormData({
          ...formData,
          recurrence: {
            ...formData.recurrence,
            type: value,
            isMaster: false,
          },
        })
      }
    />
  </div>
);

export default TaskFormFields;
