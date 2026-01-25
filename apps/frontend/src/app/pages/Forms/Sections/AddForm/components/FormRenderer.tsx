import { FormField, FormFieldType } from "@/app/types/forms";
import DropdownRenderer from "./Dropdown/DropdownRenderer";
import InputRenderer from "./Input/InputRenderer";
import SignatureRenderer from "./Signature/SignatureRenderer";
import TextRenderer from "./Text/TextRenderer";
import BooleanRenderer from "./Boolean/BooleanRenderer";
import DateRenderer from "./Date/DateRenderer";

const humanizeKey = (key: string): string => {
  const withSpaces = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return withSpaces
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getFallbackValue = (field: FormField) => {
  if (field.type === "checkbox") return [];
  if (field.type === "boolean") return false;
  if (field.type === "number" || field.type === "date") return "";
  if (field.type === "textarea" || field.type === "input") {
    return field.placeholder || "";
  }
  return "";
};

type RuntimeRendererProps = {
  field: any;
  value: any;
  onChange: (v: any) => void;
  readOnly?: boolean;
};

const runtimeComponentMap: Record<
  FormFieldType,
  React.ComponentType<RuntimeRendererProps>
> = {
  textarea: TextRenderer as any,
  input: InputRenderer as any,
  number: InputRenderer as any,
  dropdown: DropdownRenderer as any,
  radio: DropdownRenderer as any,
  checkbox: DropdownRenderer as any,
  boolean: BooleanRenderer as any,
  date: DateRenderer as any,
  signature: SignatureRenderer as any,
  group: (() => null) as any,
};

type FormRendererProps = {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (id: string, value: any) => void;
  readOnly?: boolean;
};

export const FormRenderer: React.FC<FormRendererProps> = ({
  fields,
  values,
  onChange,
  readOnly = false,
}) => {
  const labelForField = (field: FormField): string => {
    const label = (field.label ?? "").trim();
    const id = field.id ?? "";
    if (label && label !== id) return label;
    if (/_services$/i.test(id)) return "Services";
    return humanizeKey(id || "Field");
  };

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const fieldWithLabel = { ...field, label: labelForField(field) } as FormField;
        if (field.type === "group") {
          return (
            <div
              key={field.id}
              className="border border-grey-light rounded-md px-3 py-3 flex flex-col gap-3"
            >
              <div className="font-grotesk text-black-text text-[18px] font-medium">
                {fieldWithLabel.label || "Group"}
              </div>
              <FormRenderer
                fields={field.fields ?? []}
                values={values}
                onChange={onChange}
                readOnly={readOnly}
              />
            </div>
          );
        }

        const Component = runtimeComponentMap[field.type];
        const existingValue = values[field.id];
        const defaultValue = (field as any).defaultValue;
        const value = existingValue ?? defaultValue ?? getFallbackValue(field);
        return (
          <Component
            key={field.id}
            field={fieldWithLabel}
            value={value}
            onChange={(v: any) => onChange(field.id, v)}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
};

export default FormRenderer;
