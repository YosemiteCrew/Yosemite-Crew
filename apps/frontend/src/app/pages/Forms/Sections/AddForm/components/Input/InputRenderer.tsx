import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";

const InputRenderer: React.FC<{
  field: FormField & { type: "input" | "number" };
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => {
  const isReadOnly = readOnly || (field as any).meta?.readonly;
  const defaultValue = (field as any).defaultValue;
  // Use nullish coalescing to properly handle 0 values
  const displayValue = value ?? (defaultValue ?? "");

  return (
    <div className="flex flex-col gap-3">
      <FormInput
        intype={field.type === "number" ? "number" : "text"}
        inname="Label"
        value={displayValue}
        inlabel={field.label || ""}
        onChange={(e) => !isReadOnly && onChange(e.target.value)}
        className="min-h-12!"
        readonly={isReadOnly}
      />
    </div>
  );
};

export default InputRenderer;
