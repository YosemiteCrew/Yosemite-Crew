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
