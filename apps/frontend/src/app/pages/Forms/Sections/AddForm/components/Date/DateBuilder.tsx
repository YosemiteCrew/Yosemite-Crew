import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";

const DateBuilder: React.FC<{
  field: FormField & { type: "date" };
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
      inname="placeholder"
      value={field.placeholder || ""}
      inlabel="Placeholder"
      onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
      className="min-h-12!"
    />
  </div>
);

export default DateBuilder;
