import React, { useEffect, useState } from "react";
import Accordion from "./Accordion";
import FormInput from "../Inputs/FormInput/FormInput";
import { Primary, Secondary } from "../Buttons";
import Dropdown from "../Inputs/Dropdown/Dropdown";
import MultiSelectDropdown from "../Inputs/MultiSelectDropdown";
import Datepicker from "../Inputs/Datepicker";
import { getFormattedDate } from "../Calendar/weekHelpers";

type FieldConfig = {
  label: string;
  key: string;
  type?: string;
  required?: boolean;
  options?: string[];
};

type EditableAccordionProps = {
  title: string;
  fields: FieldConfig[];
  data: Record<string, any>;
  defaultOpen?: boolean;
  showEditIcon?: boolean;
  onSave?: (values: FormValues) => void | Promise<void>;
};

const FieldComponents: Record<
  string,
  React.FC<{
    field: any;
    value: any;
    error: any;
    onChange: (v: any) => void;
  }>
> = {
  text: ({ field, value, onChange, error }) => (
    <FormInput
      intype={field.type || "text"}
      inname={field.key}
      value={value}
      inlabel={field.label}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  ),
  number: ({ field, value, onChange, error }) => (
    <FormInput
      intype={field.type || "text"}
      inname={field.key}
      value={value}
      inlabel={field.label}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  ),
  select: ({ field, value, onChange }) => (
    <Dropdown
      placeholder={field.label}
      value={value || ""}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      dropdownClassName="top-[55px]! !h-fit"
      options={field.options || []}
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
    <Dropdown
      placeholder={field.label}
      value={value || ""}
      onChange={(e) => onChange(e)}
      className="min-h-12!"
      dropdownClassName="top-[55px]! !h-fit"
      type="country"
    />
  ),
  date: ({ field, value, onChange }) => (
    <Datepicker
      currentDate={value}
      setCurrentDate={onChange}
      type="input"
      placeholder={field.label}
    />
  ),
};

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
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  number: ({ field, index, fields, formValues }) => (
    <div
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  select: ({ field, index, fields, formValues }) => (
    <div
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  multiSelect: ({ field, index, fields, formValues }) => (
    <div
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {(() => {
          const value = formValues[field.key];
          if (Array.isArray(value)) {
            return value.length ? value.join(", ") : "-";
          }
          return value || "-";
        })()}
      </div>
    </div>
  ),
  country: ({ field, index, fields, formValues }) => (
    <div
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {formValues[field.key] || "-"}
      </div>
    </div>
  ),
  date: ({ field, index, fields, formValues }) => (
    <div
      className={`px-3! py-2! flex items-center gap-2 border-b border-grey-light ${index === fields.length - 1 ? "border-b-0" : ""}`}
    >
      <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
        {field.label + ":"}
      </div>
      <div className="font-satoshi font-semibold text-black-text text-[16px] overflow-scroll scrollbar-hidden">
        {getFormattedDate(formValues[field.key])}
      </div>
    </div>
  ),
};

const RenderValue = (
  field: any,
  index: number,
  fields: any,
  formValues: FormValues
) => {
  const type = field.type || "text";
  const Component = FieldValueComponents[type] || FieldComponents["text"];
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

const EditableAccordion: React.FC<EditableAccordionProps> = ({
  title,
  fields,
  data,
  defaultOpen = false,
  showEditIcon = true,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(() =>
    fields.reduce((acc, field) => {
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
      } else {
        acc[field.key] = initialValue ?? "";
      }
      return acc;
    }, {} as FormValues)
  );
  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    setFormValues(
      fields.reduce((acc, field) => {
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
        } else {
          acc[field.key] = initialValue ?? "";
        }
        return acc;
      }, {} as FormValues)
    );
    setFormValuesErrors({});
  }, [data, fields]);

  const handleChange = (key: string, value: string | string[]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormValuesErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      const value = formValues[field.key];
      if (Array.isArray(value)) {
        if (value.length === 0) {
          errors[field.key] = `${field.label} is required`;
        }
      } else if (field.type === "number") {
        if (!value) {
          errors[field.key] = `${field.label} is required`;
        }
      } else {
        const str = (value || "").trim();
        if (!str) {
          errors[field.key] = `${field.label} is required`;
        }
      }
    }
    setFormValuesErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCancel = () => {
    setFormValues(
      fields.reduce((acc, field) => {
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
        } else {
          acc[field.key] = initialValue ?? "";
        }
        return acc;
      }, {} as FormValues)
    );
    setFormValuesErrors({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      await onSave?.(formValues);
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to save accordion data:", e);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <Accordion
        title={title}
        defaultOpen={defaultOpen}
        onEditClick={() => setIsEditing((prev) => !prev)}
        isEditing={isEditing}
        showEditIcon={showEditIcon}
      >
        <div className={`flex flex-col ${isEditing ? "gap-3" : "gap-0"}`}>
          {fields.map((field, index) => (
            <div key={field.key}>
              {isEditing ? (
                <div className="flex-1">
                  {RenderField(
                    field,
                    formValues[field.key],
                    formValuesErrors[field.key],
                    (value) => handleChange(field.key, value)
                  )}
                </div>
              ) : (
                <div className="flex-1">
                  {RenderValue(field, index, fields, formValues)}
                </div>
              )}
            </div>
          ))}
        </div>
      </Accordion>

      {isEditing && (
        <div className="grid grid-cols-2 gap-3">
          <Secondary
            href="#"
            onClick={handleCancel}
            text="Cancel"
            className="h-13!"
          />
          <Primary
            href="#"
            text="Save"
            classname="h-13!"
            onClick={handleSave}
          />
        </div>
      )}
    </div>
  );
};

export default EditableAccordion;
