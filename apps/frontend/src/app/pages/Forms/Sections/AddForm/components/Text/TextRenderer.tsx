import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import { FormField } from "@/app/types/forms";

const TextRenderer: React.FC<{
  field: FormField & { type: "textarea" };
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => (
  <div className="flex flex-col gap-3">
    <FormDesc
      intype="text"
      inname={field.id}
      value={value || field.placeholder || ""}
      inlabel={field.label || ""}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[120px]! max-h-[140px]!"
    />
  </div>
);

export default TextRenderer;
