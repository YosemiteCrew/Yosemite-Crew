import React from 'react';
import { FormField } from '@/app/features/forms/types/forms';
import {
  labelForOption,
  taskBlockValue,
} from '@/app/features/forms/pages/Forms/Sections/taskTemplateSummary.helpers';

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
