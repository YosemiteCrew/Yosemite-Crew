import React, { useEffect, useState } from "react";
import Accordion from "./Accordion";
import FormInput from "../Inputs/FormInput/FormInput";
import { Primary, Secondary } from "../Buttons";
import Dropdown from "../Inputs/Dropdown/Dropdown";

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

const EditableAccordion: React.FC<EditableAccordionProps> = ({
  title,
  fields,
  data,
  defaultOpen = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    fields.reduce(
      (acc, field) => {
        acc[field.key] = data?.[field.key] ?? "";
        return acc;
      },
      {} as Record<string, string>
    )
  );
  const [formValuesErrors, setFormValuesErrors] = useState<
    Record<string, string | undefined>
  >({});

  useEffect(() => {
    setFormValues(
      fields.reduce(
        (acc, field) => {
          acc[field.key] = data?.[field.key] ?? "";
          return acc;
        },
        {} as Record<string, string>
      )
    );
    setFormValuesErrors({});
  }, [data, fields]);

  const hasData = fields.some((field) => {
    const raw = formValues[field.key];
    if (raw === null || raw === undefined) return false;
    return String(raw).trim().length > 0;
  });

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormValuesErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required === false) continue;
      const value = (formValues[field.key] || "").trim();
      if (!value) {
        errors[field.key] = `${field.label} is required`;
      }
    }
    setFormValuesErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCancel = () => {
    setFormValues(
      fields.reduce(
        (acc, field) => {
          acc[field.key] = data?.[field.key] ?? "";
          return acc;
        },
        {} as Record<string, string>
      )
    );
    setFormValuesErrors({});
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!validate()) return;
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <Accordion
        title={title}
        defaultOpen={defaultOpen}
        onEditClick={() => setIsEditing((prev) => !prev)}
        isEditing={isEditing}
        hasData={hasData}
      >
        {!isEditing && !hasData ? null : (
          <div className={`flex flex-col ${isEditing ? "gap-3" : "gap-0"}`}>
            {fields.map((field) => (
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
                  <div className="px-3! py-2! flex items-center gap-2 border-b border-grey-light">
                    <div className="font-satoshi font-semibold text-grey-bg text-[16px]">
                      {field.label + " :"}
                    </div>
                    <div className="font-satoshi font-semibold text-black-text text-[16px]">
                      {formValues[field.key] || "-"}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
