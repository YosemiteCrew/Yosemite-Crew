import React, { useEffect, useMemo, useState, useCallback } from "react";
import Accordion from "./Accordion";
import FormInput from "../Inputs/FormInput/FormInput";
import { Primary, Secondary } from "../Buttons";
import MultiSelectDropdown from "../Inputs/MultiSelectDropdown";
import Datepicker from "../Inputs/Datepicker";
import { formatDisplayDate } from "@/app/pages/Inventory/utils";
import { getFormattedDate } from "../Calendar/weekHelpers";
import { formatTimeLabel } from "@/app/utils/forms";
import { toTitleCase } from "@/app/utils/validators";
import LabelDropdown from "../Inputs/Dropdown/LabelDropdown";
import { CountriesOptions } from "../AddCompanion/type";

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
  readOnly?: boolean;
  showDeleteIcon?: boolean;
  onSave?: (values: FormValues) => void | Promise<void>;
  onDelete?: () => void;
  hideInlineActions?: boolean;
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
          intype={field.type || "text"}
          inname={field.key}
          value={value}
          inlabel={field.label}
          error={error}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-12! pl-10!"
        />
      </div>
    ) : (
      <FormInput
        intype={field.type || "text"}
        inname={field.key}
        value={value}
        inlabel={field.label}
        error={error}
        onChange={(e) => onChange(e.target.value)}
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
          intype={field.type || "text"}
          inname={field.key}
          value={value}
          inlabel={field.label}
          error={error}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-12! pl-10!"
        />
      </div>
    ) : (
      <FormInput
        intype={field.type || "text"}
        inname={field.key}
        value={value}
        inlabel={field.label}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12!"
      />
    );
  },
  select: ({ field, value, onChange }) => (
    <LabelDropdown
      placeholder={field.label}
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={field.options}
    />
  ),
  dropdown: ({ field, value, onChange }) => (
    <LabelDropdown
      placeholder={field.label}
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={field.options}
    />
  ),
  multiSelect: ({ field, value, onChange }) => (
    <MultiSelectDropdown
      placeholder={field.label}
      value={value || []}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      options={field.options || []}
      dropdownClassName="h-fit!"
    />
  ),
  country: ({ field, value, onChange }) => (
    <LabelDropdown
      placeholder="Choose country"
      onSelect={(option) => onChange(option.value)}
      defaultOption={value}
      options={CountriesOptions}
    />
  ),
  date: ({ field, value, onChange }) => {
    const parseDate = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val === "string" && val.includes("/")) {
        const [dd, mm, yyyy] = val.split("/");
        const parsed = new Date(`${yyyy}-${mm}-${dd}`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      const parsed = new Date(val);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const formatDate = (date: Date) => date.toISOString().split("T")[0];
    return (
      <Datepicker
        currentDate={parseDate(value)}
        setCurrentDate={(
          next: Date | null | ((prev: Date | null) => Date | null)
        ) => {
          const resolved =
            typeof next === "function"
              ? (next as (prev: Date | null) => Date | null)(parseDate(value))
              : next;
          if (resolved) {
            onChange(formatDate(resolved));
          } else {
            onChange("");
          }
        }}
        type="input"
        placeholder={field.label}
      />
    );
  },
  time: ({ field, value, onChange, error }) => (
    <FormInput
      intype={"text"}
      inname={field.key}
      value={formatTimeLabel(value)}
      inlabel={field.label}
      error={error}
      onChange={(e) => {}}
      className="min-h-12!"
    />
  ),
};

const normalizeOptions = (
  options?: Array<string | { label: string; value: string }>
) =>
  options?.map((option: any) =>
    typeof option === "string" ? { label: option, value: option } : option
  ) ?? [];

const resolveLabel = (
  options: Array<{ label: string; value: string }>,
  value: string
) => options.find((o) => o.value === value)?.label ?? value;

const RenderField = (
  field: any,
  value: any,
  error: string | undefined,
  onChange: (value: any) => void
) => {
  const type = field.type || "text";
  const Component = FieldComponents[type] || FieldComponents["text"];
  return (
    <Component field={field} value={value} error={error} onChange={onChange} />
  );
};

const isCurrencyField = (fieldKey: string) => {
  return fieldKey === "purchaseCost" || fieldKey === "selling";
};

const formatCurrencyValue = (value: any) => {
  if (!value || value === "-") return "-";
  return `$${value}`;
};

const FieldValueComponents: Record<
  string,
  React.FC<{
    field: any;
    index: number;
    fields: any;
    formValues: FormValues;
  }>
> = {
  text: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {Array.isArray(formValues[field.key])
          ? (formValues[field.key] as string[]).join(", ")
          : formValues[field.key] || "-"}
      </div>
    </div>
  ),
  status: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {toTitleCase(formValues[field.key])}
      </div>
    </div>
  ),
  number: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  select: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (options.length) return resolveLabel(options, value);
          return value || "-";
        })()}
      </div>
    </div>
  ),
  dropdown: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (options.length) return resolveLabel(options, value);
          return value || "-";
        })()}
      </div>
    </div>
  ),
  multiSelect: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {(() => {
          const value = formValues[field.key];
          const options = normalizeOptions(field.options);
          if (Array.isArray(value)) {
            if (!value.length) return "-";
            if (options.length) {
              return value
                .map((v: string) => resolveLabel(options, v))
                .join(", ");
            }
            return value.join(", ");
          }
          if (options.length) {
            return resolveLabel(options, value);
          }
          return value || "-";
        })()}
      </div>
    </div>
  ),
  country: ({ field, index, fields, formValues }) => (
    <div
      className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
    >
      <div className="text-body-4-emphasis text-text-tertiary">
        {field.label}
      </div>
      <div className="text-body-4 text-text-primary">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  date: ({ field, index, fields, formValues }) => {
    const value = formValues[field.key];
    return (
      <div
        className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
      >
        <div className="text-body-4-emphasis text-text-tertiary">
          {field.label}
        </div>
        <div className="text-body-4 text-text-primary">
          {typeof value === "string"
            ? formatDisplayDate(value) || "-"
            : getFormattedDate(formValues[field.key])}
        </div>
      </div>
    );
  },
  time: ({ field, index, fields, formValues }) => {
    const value = formValues[field.key];
    return (
      <div
        className={`py-2.5! flex items-center gap-2 justify-between border-t border-card-border`}
      >
        <div className="text-body-4-emphasis text-text-tertiary">
          {field.label}
        </div>
        <div className="text-body-4 text-text-primary">
          {formatTimeLabel(value)}
        </div>
      </div>
    );
  },
};

const RenderValue = (
  field: any,
  index: number,
  fields: any,
  formValues: FormValues
) => {
  const type = field.type || "text";
  const Component = FieldValueComponents[type] || FieldValueComponents["text"];
  return (
    <Component
      field={field}
      index={index}
      fields={fields}
      formValues={formValues}
    />
  );
};

type FormValues = Record<string, any>;

const buildInitialValues = (
  fields: FieldConfig[],
  data: Record<string, any>
): FormValues =>
  fields.reduce((acc, field) => {
    if (!isFieldEditable(field)) return acc;
    const initialValue = data?.[field.key];
    if (field.type === "multiSelect") {
      let value: string | string[] = [];
      if (Array.isArray(initialValue)) {
        value = initialValue;
      } else if (
        typeof initialValue === "string" &&
        initialValue.trim() !== ""
      ) {
        value = [initialValue];
      }
      acc[field.key] = value;
    } else if (field.type === "date") {
      acc[field.key] = initialValue ?? "";
    } else {
      acc[field.key] = initialValue ?? "";
    }
    return acc;
  }, {} as FormValues);

const getRequiredError = (
  field: FieldConfig,
  value: any
): string | undefined => {
  if (!isFieldEditable(field)) return undefined;
  if (!field.required) return undefined;
  const label = `${field.label} is required`;

  if (Array.isArray(value)) {
    return value.length === 0 ? label : undefined;
  }
  if (field.type === "number") {
    return value ? undefined : label;
  }
  return (value || "").toString().trim() ? undefined : label;
};

const EditableAccordion: React.FC<EditableAccordionProps> = ({
  title,
  fields,
  data,
  defaultOpen = false,
  showEditIcon = true,
  readOnly = false,
  showDeleteIcon = false,
  onSave,
  onDelete,
  hideInlineActions = false,
  onEditingChange,
  onRegisterActions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() =>
    buildInitialValues(fields, data)
  );
  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});

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
    setFormValues(buildInitialValues(fields, data));
    setFormValuesErrors({});
    setIsEditing(false);
  }, [fields, data]);

  useEffect(() => {
    if (readOnly && isEditing) {
      setIsEditing(false);
      onEditingChange?.(false);
    }
  }, [readOnly, isEditing, onEditingChange]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    try {
      await onSave?.(formValues);
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to save accordion data:", e);
    }
  }, [formValues, onSave, validate]);

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
  }, [
    onRegisterActions,
    handleSave,
    handleCancel,
    isEditing,
    onEditingChange,
    fields,
    data,
  ]);

  const effectiveEditing = readOnly ? false : isEditing;

  const displayValues: FormValues = useMemo(
    () => ({ ...data, ...formValues }),
    [data, formValues]
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      <Accordion
        title={title}
        defaultOpen={defaultOpen}
        onEditClick={() => !readOnly && setIsEditing((prev) => !prev)}
        isEditing={effectiveEditing}
        showEditIcon={!readOnly && showEditIcon}
        showDeleteIcon={showDeleteIcon}
        onDeleteClick={onDelete}
      >
        <div className={`flex flex-col`}>
          {fields.map((field, index) => {
            const canEditThisField =
              !readOnly && effectiveEditing && isFieldEditable(field);
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
                  <div className="flex-1">
                    {RenderValue(field, index, fields, displayValues)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Accordion>

      {isEditing && !hideInlineActions && (
        <div className="grid grid-cols-2 gap-3">
          <Primary href="#" text="Save" onClick={handleSave} />
          <Secondary href="#" onClick={handleCancel} text="Cancel" />
        </div>
      )}
    </div>
  );
};

export default EditableAccordion;
