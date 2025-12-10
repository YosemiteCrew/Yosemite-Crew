import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { DropdownField, FormField } from "@/app/types/forms";

const DropdownBuilder: React.FC<{
  field: DropdownField;
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const updateOption = (idx: number, value: string) => {
    const options = [...field.options];
    options[idx] = value;
    onChange({ ...field, options });
  };

  const addOption = () =>
    onChange({ ...field, options: [...field.options, ""] });

  const removeOption = (idx: number) =>
    onChange({
      ...field,
      options: field.options.filter((_, i) => i !== idx),
    });

  return (
    <div className="flex flex-col gap-3">
      <FormInput
        intype="text"
        inname="Label"
        value={field.label || ""}
        inlabel="Label"
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        className="min-h-12!"
      />

      {field.options.map((opt, i) => (
        <div key={i + opt} className="relative">
          <FormInput
            intype="text"
            inname="dropdown"
            value={opt}
            inlabel={"Dropdown option " + i}
            onChange={(e) => updateOption(i, e.target.value)}
            className="min-h-12!"
          />
          <button type="button" onClick={() => removeOption(i)} className="absolute right-4 top-3">
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={addOption} className="mb-3">
        + Add option
      </button>
    </div>
  );
};

export default DropdownBuilder;