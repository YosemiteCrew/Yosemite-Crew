import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";

const InputRenderer: React.FC<{
  field: FormField & { type: "input" | "number" };
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype={field.type === "number" ? "number" : "text"}
      inname="Label"
      value={value}
      inlabel={field.label || ""}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  </div>
);

export default InputRenderer;
