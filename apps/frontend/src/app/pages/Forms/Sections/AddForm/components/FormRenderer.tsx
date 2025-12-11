import { FormField, FormFieldType } from "@/app/types/forms";
import DropdownRenderer from "./Dropdown/DropdownRenderer";
import InputRenderer from "./Input/InputRenderer";
import SignatureRenderer from "./Signature/SignatureRenderer";
import TextRenderer from "./Text/TextRenderer";
import BooleanRenderer from "./Boolean/BooleanRenderer";
import DateRenderer from "./Date/DateRenderer";

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
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        if (field.type === "group") {
          return (
            <div
              key={field.id}
              className="border border-grey-light rounded-2xl px-3 py-3 flex flex-col gap-3"
            >
              <div className="font-grotesk text-black-text text-[18px] font-medium">
                {field.label || "Group"}
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
        const value = existingValue ?? getFallbackValue(field);
        return (
          <Component
            key={field.id}
            field={field}
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
