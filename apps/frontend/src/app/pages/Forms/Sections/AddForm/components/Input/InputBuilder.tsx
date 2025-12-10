import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";

const InputBuilder: React.FC<{
  field: FormField & { type: "input" | "number" };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="text"
      inname="Label"
      value={field.label || ""}
      inlabel="Label"
      onChange={(e) => onChange({ ...field, label: e.target.value })}
      className="min-h-12!"
    />
    <FormInput
      intype={field.type === "number" ? "number" : "text"}
      inname="placeholder"
      value={field.placeholder || ""}
      inlabel="Placeholder"
      onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
      className="min-h-12!"
    />
  </div>
);

export default InputBuilder;
