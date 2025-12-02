import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { InputField } from "@/app/types/forms";

const InputRenderer: React.FC<{
  field: InputField;
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="text"
      inname="Label"
      value={value}
      inlabel={field.label || ""}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
    />
  </div>
);

export default InputRenderer;
