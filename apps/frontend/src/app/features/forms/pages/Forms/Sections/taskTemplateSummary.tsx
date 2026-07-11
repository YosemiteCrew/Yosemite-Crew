import React from 'react';
import { FormField, RequiredSignerOptions } from '@/app/features/forms/types/forms';

/** Read a task block's authored value for a given taskBlockKey (defaultValue, else placeholder).
 *  `additionalNotes` falls back to the legacy `description` block key. */
export const taskBlockValue = (
  block: FormField & { fields?: FormField[] },
  key: string
): string => {
  const field = (block.fields ?? []).find(
    (item) => (item.meta as { taskBlockKey?: string })?.taskBlockKey === key
  );
  if (!field && key === 'additionalNotes') {
    return taskBlockValue(block, 'description');
  }
  if (!field) return '';
  const value = (field as FormField & { defaultValue?: unknown }).defaultValue;
  if (value !== undefined && value !== '') return String(value);
  return field.placeholder ?? '';
};

export const labelForOption = (
  options: { label: string; value: string }[],
  value: string
): string => options.find((option) => option.value === value)?.label ?? value;

export const baseDetailsFields = [
  { label: 'Form name', key: 'name', type: 'text' },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Signed by', key: 'requiredSigner', type: 'dropdown', options: RequiredSignerOptions },
];

/** Read-only summary of the task blocks authored in a Task Template. */
export const TaskTemplateSummary = ({ schema }: { schema: FormField[] }) => {
  const group = schema.find(
    (field): field is FormField & { fields?: FormField[] } =>
      field.type === 'group' && Boolean((field.meta as { taskGroup?: boolean })?.taskGroup)
  );
  const blocks = (group?.fields ?? []).filter(
    (field): field is FormField & { fields?: FormField[] } => field.type === 'group'
  );

  if (blocks.length === 0) {
    return <p className="text-body-4 text-text-secondary">No tasks added yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const categoryField = (block.fields ?? []).find(
          (field) => (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'category'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const repeatField = (block.fields ?? []).find(
          (field) => (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'recurrence.type'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const reminderField = (block.fields ?? []).find(
          (field) =>
            (field.meta as { taskBlockKey?: string })?.taskBlockKey === 'reminderOffsetMinutes'
        ) as (FormField & { options?: { label: string; value: string }[] }) | undefined;
        const duration = taskBlockValue(block, 'durationDays');
        const instructions = taskBlockValue(block, 'additionalNotes');

        return (
          <li
            key={block.id}
            className="flex flex-col gap-1 rounded-2xl border border-card-border p-3"
          >
            <span className="text-body-3-emphasis text-text-primary">
              {taskBlockValue(block, 'name') || `Task ${index + 1}`}
            </span>
            <span className="text-caption-1 text-text-secondary">
              {labelForOption(categoryField?.options ?? [], taskBlockValue(block, 'category'))} ·{' '}
              {labelForOption(repeatField?.options ?? [], taskBlockValue(block, 'recurrence.type'))}
              {reminderField &&
                taskBlockValue(block, 'reminderOffsetMinutes') &&
                ` · ${labelForOption(reminderField.options ?? [], taskBlockValue(block, 'reminderOffsetMinutes'))}`}
              {duration && ` · ${duration} day${duration === '1' ? '' : 's'}`}
            </span>
            {instructions && (
              <span className="text-caption-1 text-text-secondary">{instructions}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
};
