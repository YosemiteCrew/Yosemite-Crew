import { FormField } from '@/app/features/forms/types/forms';

export const buildInitialValues = (fields: FormField[]): Record<string, any> => {
  const acc: Record<string, any> = {};
  const getDefaultValue = (field: FormField): unknown => (field as any).defaultValue;
  const walk = (items: FormField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        walk(field.fields ?? []);
        return;
      }
      const defaultValue = getDefaultValue(field);

      if (field.type === 'checkbox') {
        acc[field.id] = defaultValue ?? [];
      } else if (field.type === 'boolean') {
        acc[field.id] = defaultValue ?? false;
      } else {
        acc[field.id] = defaultValue === undefined ? '' : defaultValue;
      }
    });
  };
  walk(fields);
  return acc;
};
