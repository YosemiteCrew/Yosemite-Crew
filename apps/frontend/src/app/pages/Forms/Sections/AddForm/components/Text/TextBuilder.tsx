import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import { FormField, TextField } from "@/app/types/forms";

const TextBuilder: React.FC<{
  field: TextField;
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormDesc
      intype="text"
      inname="static-text"
      value={field.value}
      inlabel="Text content"
      onChange={(e) => onChange({ ...field, value: e.target.value })}
      className="min-h-[120px]! max-h-[120px]!"
    />
  </div>
);

export default TextBuilder;
