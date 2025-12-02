import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField, InputField } from "@/app/types/forms";

const InputBuilder: React.FC<{
  field: InputField;
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
      intype="text"
      inname="value"
      value={field.value}
      inlabel="Default value"
      onChange={(e) => onChange({ ...field, value: e.target.value })}
      className="min-h-12!"
    />
  </div>
);

export default InputBuilder;
