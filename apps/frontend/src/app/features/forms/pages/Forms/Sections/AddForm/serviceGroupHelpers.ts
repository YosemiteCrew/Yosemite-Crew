import { FormField } from '@/app/features/forms/types/forms';

export type ServiceOption = { label: string; value: string; badge?: string };

export const isServiceGroup = (field: FormField): field is FormField & { type: 'group' } =>
  field.type === 'group' && Boolean(field.meta?.serviceGroup);

export const getServiceCheckbox = (
  field: FormField & { type: 'group'; fields?: FormField[] }
): (FormField & { type: 'checkbox'; options?: { label: string; value: string }[] }) | undefined =>
  (field.fields ?? []).find(
    (f): f is FormField & { type: 'checkbox'; options?: { label: string; value: string }[] } =>
      f.type === 'checkbox'
  );

export const ensureServiceCheckbox = (
  field: FormField & { type: 'group' },
  serviceOptions: ServiceOption[]
): { group: FormField & { type: 'group'; fields: FormField[] }; selected: string[] } => {
  const existingCheckbox = getServiceCheckbox(field);
  const selected = existingCheckbox?.options?.map((opt) => opt.value) ?? [];

  const nextMeta = field.meta
    ? { ...field.meta, serviceGroup: true, serviceIds: selected }
    : { serviceGroup: true, serviceIds: selected };

  const checkbox: FormField = {
    id: existingCheckbox?.id || `${field.id}_services`,
    type: 'checkbox',
    label: '', // Empty label to avoid duplicate "Services" text
    options: selected.map((val) => {
      const match = serviceOptions.find((o) => o.value === val);
      return match ?? { label: val, value: val };
    }),
    multiple: true,
    meta: existingCheckbox?.meta
      ? { ...existingCheckbox.meta, serviceIds: selected }
      : { serviceIds: selected },
  };

  const otherFields = (field.fields ?? []).filter((f) => f.id !== checkbox.id);

  return {
    group: {
      ...field,
      meta: nextMeta,
      fields: [...otherFields, checkbox],
    },
    selected,
  };
};

export const normalizeServiceGroups = (
  schema: FormField[],
  serviceOptions: ServiceOption[]
): FormField[] =>
  serviceOptions.length
    ? schema.map((field) =>
        isServiceGroup(field) ? ensureServiceCheckbox(field, serviceOptions).group : field
      )
    : schema;
