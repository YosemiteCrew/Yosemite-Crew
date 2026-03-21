import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { formatDisplayDate } from '@/app/features/inventory/pages/Inventory/utils';
import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { formatTimeLabel } from '@/app/lib/forms';
import { formatDateLocal } from '@/app/lib/date';
import { toTitleCase } from '@/app/lib/validators';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { CountriesOptions } from '@/app/features/companions/components/AddCompanion/type';

export type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  options?: Array<string | { label: string; value: string }>;
  editable?: boolean;
};

type EditableAccordionProps = {
  title: string;
  fields: FieldConfig[];
  data: Record<string, any>;
  defaultOpen?: boolean;
  showEditIcon?: boolean;
  rightElement?: React.ReactNode;
  readOnly?: boolean;
  showDeleteIcon?: boolean;
  onSave?: (values: FormValues) => void | Promise<void>;
  onDelete?: () => void;
  hideInlineActions?: boolean;
  compactInlineActions?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  onRegisterActions?: (
    actions: {
      save: () => Promise<void>;
      cancel: () => void;
      startEditing: () => void;
      isEditing: () => boolean;
    } | null
  ) => void;
};

const isFieldEditable = (field: FieldConfig) => field.editable !== false;

const FieldComponents: Record<
  string,
  React.FC<{
    field: any;
    value: any;
    error: any;
    onChange: (v: any) => void;
  }>
> = {
  text: ({ field, value, onChange, error }) => {
    const isCurrency = isCurrencyField(field.key);
    return isCurrency ? (
      <div className="relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-body-4 text-text-primary font-satoshi font-semibold z-10">
          $
        </div>
        <FormInput
          intype={field.type || 'text'}
          inname={field.key}
          value={value}
          inlabel={field.label}
          error={error}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="min-h-12! pl-10!"
        />
      </div>
    ) : (
      <FormInput
        intype={field.type || 'text'}
        inname={field.key}
        value={value}
        inlabel={field.label}
        error={error}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="min-h-12!"
      />
    );
  },
  number: ({ field, value, onChange, error }) => {
    const isCurrency = isCurrencyField(field.key);
    return isCurrency ? (
      <div className="relative">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-body-4 text-text-primary font-satoshi font-semibold z-10">
          $
        </div>
        <FormInput
          intype={field.type || 'text'}
          inname={field.key}
          value={value}
          inlabel={field.label}
          error={error}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="min-h-12! pl-10!"
        />
      </div>
    ) : (
      <FormInput
        intype={field.type || 'text'}
        inname={field.key}
        value={value}
        inlabel={field.label}
        error={error}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="min-h-12!"
      />
    );
  },
  select: ({ field, value, onChange, error }) => {
    const normalizedOptions = (field.options || []).map((opt: any) =>
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
    return (
      <LabelDropdown
        placeholder={field.label}
        onSelect={(option: { value: string }) => onChange(option.value)}
        defaultOption={value}
        options={normalizedOptions}
        error={error}
      />
    );
  },
  dropdown: ({ field, value, onChange, error }) => {
    const normalizedOptions = (field.options || []).map((opt: any) =>
      typeof opt === 'string' ? { label: opt, value: opt } : opt
    );
    return (
      <LabelDropdown
        placeholder={field.label}
        onSelect={(option: { value: string }) => onChange(option.value)}
        defaultOption={value}
        options={normalizedOptions}
        error={error}
      />
    );
  },
  multiSelect: ({ field, value, onChange, error }) => (
    <MultiSelectDropdown
      placeholder={field.label}
      value={value || []}
      onChange={(e: unknown) => onChange(e)}
      options={field.options || []}
      error={error}
    />
  ),
  country: ({ value, onChange, error }) => (
    <LabelDropdown
      placeholder="Choose country"
      onSelect={(option: { value: string }) => onChange(option.value)}
      defaultOption={value}
      options={CountriesOptions}
      error={error}
    />
  ),
  date: ({ field, value, onChange, error }) => {
    const parseDate = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val === 'string' && val.includes('/')) {
        const [dd, mm, yyyy] = val.split('/');
        const parsed = new Date(`${yyyy}-${mm}-${dd}`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const [yyyy, mm, dd] = val.split('-').map(Number);
        const parsed = new Date(yyyy, mm - 1, dd);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      const parsed = new Date(val);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const formatDate = (date: Date) => formatDateLocal(date);
    return (
      <Datepicker
        currentDate={parseDate(value)}
        setCurrentDate={(next: Date | null | ((prev: Date | null) => Date | null)) => {
          const resolved =
            typeof next === 'function'
              ? (next as (prev: Date | null) => Date | null)(parseDate(value))
              : next;
          if (resolved) {
            onChange(formatDate(resolved));
          } else {
            onChange('');
          }
        }}
        type="input"
        placeholder={field.label}
        error={error}
      />
    );
  },
  time: ({ field, value, error }) => (
    <FormInput
      intype={'text'}
      inname={field.key}
      value={formatTimeLabel(value)}
      inlabel={field.label}
      error={error}
      onChange={() => {}}
      className="min-h-12!"
    />
  ),
  timeInput: ({ field, value, onChange, error }) => (
    <FormInput
      intype="time"
      inname={field.key}
      value={value || ''}
      inlabel={field.label}
      error={error}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className="min-h-12!"
    />
  ),
};

const normalizeOptions = (options?: Array<string | { label: string; value: string }>) =>
  options?.map((option: any) =>
    typeof option === 'string' ? { label: option, value: option } : option
  ) ?? [];

const resolveLabel = (options: Array<{ label: string; value: string }>, value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const RenderField = (
  field: any,
  value: any,
  error: string | undefined,
  onChange: (value: any) => void
) => {
  const type = field.type || 'text';
  const Component = FieldComponents[type] || FieldComponents['text'];
  return <Component field={field} value={value} error={error} onChange={onChange} />;
};

const isCurrencyField = (fieldKey: string) => {
  return fieldKey === 'purchaseCost' || fieldKey === 'selling';
};

const FieldValueComponents: Record<
  string,
  React.FC<{
    field: any;
    formValues: FormValues;
  }>
> = {
  text: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">
        {Array.isArray(formValues[field.key])
          ? (formValues[field.key] as string[]).join(', ')
          : formValues[field.key] || '-'}
      </div>
    </div>
  ),
  status: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">
        {toTitleCase(formValues[field.key])}
      </div>
    </div>
  ),
  number: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">{formValues[field.key] || '-'}</div>
    </div>
  ),
  select: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (options.length) return resolveLabel(options, value);
          return value || '-';
        })()}
      </div>
    </div>
  ),
  dropdown: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (options.length) return resolveLabel(options, value);
          return value || '-';
        })()}
      </div>
    </div>
  ),
  multiSelect: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (Array.isArray(value)) {
            if (!value.length) return '-';
            if (options.length) {
              return value.map((v: string) => resolveLabel(options, v)).join(', ');
            }
            return value.join(', ');
          }
          if (options.length) {
            return resolveLabel(options, value);
          }
          return value || '-';
        })()}
      </div>
    </div>
  ),
  country: ({ field, formValues }) => (
    <div className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}>
      <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
      <div className="text-body-4 text-text-primary text-right">{formValues[field.key] || '-'}</div>
    </div>
  ),
  date: ({ field, formValues }) => {
    const value = formValues[field.key];
    return (
      <div
        className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
      >
        <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
        <div className="text-body-4 text-text-primary text-right">
          {typeof value === 'string'
            ? formatDisplayDate(value) || '-'
            : getFormattedDate(formValues[field.key])}
        </div>
      </div>
    );
  },
  time: ({ field, formValues }) => {
    const value = formValues[field.key];
    return (
      <div
        className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
      >
        <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
        <div className="text-body-4 text-text-primary text-right">{formatTimeLabel(value)}</div>
      </div>
    );
  },
  timeInput: ({ field, formValues }) => {
    const value = formValues[field.key];
    return (
      <div
        className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
      >
        <div className="text-body-4-emphasis text-text-tertiary">{field.label}</div>
        <div className="text-body-4 text-text-primary text-right">
          {value ? formatTimeLabel(value) : '-'}
        </div>
      </div>
    );
  },
};

const RenderValue = (field: any, formValues: FormValues) => {
  const type = field.type || 'text';
  const Component = FieldValueComponents[type] || FieldValueComponents['text'];
  return <Component field={field} formValues={formValues} />;
};

type FormValues = Record<string, any>;

const buildInitialValues = (fields: FieldConfig[], data: Record<string, any>): FormValues =>
  fields.reduce((acc, field) => {
    if (!isFieldEditable(field)) return acc;
    const initialValue = data?.[field.key];
    if (field.type === 'multiSelect') {
      let value: string | string[] = [];
      if (Array.isArray(initialValue)) {
        value = initialValue;
      } else if (typeof initialValue === 'string' && initialValue.trim() !== '') {
        value = [initialValue];
      }
      acc[field.key] = value;
    } else if (field.type === 'date') {
      acc[field.key] = initialValue ?? '';
    } else {
      acc[field.key] = initialValue ?? '';
    }
    return acc;
  }, {} as FormValues);

const getRequiredError = (field: FieldConfig, value: any): string | undefined => {
  if (!isFieldEditable(field)) return undefined;
  if (!field.required) return undefined;
  const label = `${field.label} is required`;

  if (Array.isArray(value)) {
    return value.length === 0 ? label : undefined;
  }
  if (field.type === 'number') {
    return value ? undefined : label;
  }
  return (value || '').toString().trim() ? undefined : label;
};

const EditableAccordion: React.FC<EditableAccordionProps> = ({
  title,
  fields,
  data,
  defaultOpen = false,
  showEditIcon = true,
  rightElement,
  readOnly = false,
  showDeleteIcon = false,
  onSave,
  onDelete,
  hideInlineActions = false,
  compactInlineActions = false,
  onEditingChange,
  onRegisterActions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(() => buildInitialValues(fields, data));
  const [formValuesErrors, setFormValuesErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    setFormValues(buildInitialValues(fields, data));
    setFormValuesErrors({});
  }, [data, fields]);

  const handleChange = (key: string, value: string | string[]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormValuesErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const error = getRequiredError(field, formValues[field.key]);
      if (error) {
        errors[field.key] = error;
      }
    }
    setFormValuesErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fields, formValues]);

  const handleCancel = useCallback(() => {
    if (isSaving) return;
    setFormValues(buildInitialValues(fields, data));
    setFormValuesErrors({});
    setIsEditing(false);
  }, [data, fields, isSaving]);

  useEffect(() => {
    if (readOnly && isEditing) {
      setIsEditing(false);
      onEditingChange?.(false);
    }
  }, [readOnly, isEditing, onEditingChange]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave?.(formValues);
      setIsEditing(false);
      setError(null);
    } catch (e) {
      console.error('Failed to save accordion data:', e);
      setError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [formValues, isSaving, onSave, validate]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    onRegisterActions?.({
      save: handleSave,
      cancel: handleCancel,
      startEditing: () => {
        setIsEditing(true);
      },
      isEditing: () => isEditing,
    });
    return () => onRegisterActions?.(null);
  }, [onRegisterActions, handleSave, handleCancel, isEditing, onEditingChange, fields, data]);

  const effectiveEditing = readOnly ? false : isEditing;

  const displayValues: FormValues = useMemo(() => ({ ...data, ...formValues }), [data, formValues]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <Accordion
        title={title}
        defaultOpen={defaultOpen}
        onEditClick={() => !readOnly && setIsEditing((prev) => !prev)}
        isEditing={effectiveEditing}
        showEditIcon={!readOnly && showEditIcon}
        rightElement={rightElement}
        showDeleteIcon={showDeleteIcon}
        onDeleteClick={onDelete}
      >
        <div className={`flex flex-col`}>
          {fields.map((field) => {
            const canEditThisField = !readOnly && effectiveEditing && isFieldEditable(field);
            return (
              <div key={field.key}>
                {canEditThisField ? (
                  <div className="flex-1 mb-3">
                    {RenderField(
                      field,
                      formValues[field.key],
                      formValuesErrors[field.key],
                      (value) => handleChange(field.key, value)
                    )}
                  </div>
                ) : (
                  <div className="flex-1">{RenderValue(field, displayValues)}</div>
                )}
              </div>
            );
          })}
        </div>
      </Accordion>

      {isEditing && !hideInlineActions && (
        <div
          className={
            compactInlineActions
              ? 'flex justify-center items-center gap-3 w-full flex-row'
              : 'flex justify-end items-end gap-3 w-full flex-col'
          }
        >
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <div
            className={
              compactInlineActions
                ? 'flex items-center justify-center gap-3'
                : 'grid grid-cols-2 gap-3 w-full'
            }
          >
            <Secondary href="#" onClick={handleCancel} text="Cancel" isDisabled={isSaving} />
            <Primary
              href="#"
              text={isSaving ? 'Saving...' : 'Save'}
              onClick={handleSave}
              isDisabled={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableAccordion;
