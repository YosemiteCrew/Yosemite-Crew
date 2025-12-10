import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField, SignatureField } from "@/app/types/forms";

const SignatureBuilder: React.FC<{
  field: SignatureField;
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
  </div>
);

export default SignatureBuilder;
