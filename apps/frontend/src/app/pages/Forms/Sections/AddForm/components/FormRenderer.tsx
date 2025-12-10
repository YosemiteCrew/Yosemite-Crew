import { FormField, FormFieldType } from "@/app/types/forms";
import DropdownRenderer from "./Dropdown/DropdownRenderer";
import InputRenderer from "./Input/InputRenderer";
import SignatureRenderer from "./Signature/SignatureRenderer";
import TextRenderer from "./Text/TextRenderer";

type RuntimeRendererProps = {
  field: any;
  value: string;
  onChange: (v: string) => void;
};

const runtimeComponentMap: Record<
  FormFieldType,
  React.ComponentType<RuntimeRendererProps>
> = {
  text: TextRenderer,
  input: InputRenderer,
  dropdown: DropdownRenderer,
  signature: SignatureRenderer,
};

type FormRendererProps = {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
};

export const FormRenderer: React.FC<FormRendererProps> = ({
  fields,
  values,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const Component = runtimeComponentMap[field.type];
        const value = values[field.id] ?? "";
        return (
          <Component
            key={field.id}
            field={field}
            value={value}
            onChange={(v: string) => onChange(field.id, v)}
          />
        );
      })}
    </div>
  );
};

export default FormRenderer;
