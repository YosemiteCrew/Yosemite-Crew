import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";

const DropdownBuilder: React.FC<{
  field: FormField & { type: "dropdown" | "radio" | "checkbox" };
  onChange: (f: FormField) => void;
}> = ({ field, onChange }) => {
  const options = field.options ?? [];

  const updateOption = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = {
      label: value,
      value: options[idx]?.value ?? value,
    };
    onChange({ ...field, options: next });
  };

  const addOption = () =>
    onChange({
      ...field,
      options: [
        ...options,
        { label: `Option ${options.length + 1}`, value: crypto.randomUUID() },
      ],
    });

  const removeOption = (idx: number) =>
    onChange({
      ...field,
      options: options.filter((_, i) => i !== idx),
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

      {options.map((opt, i) => (
        <div key={opt.value ?? i} className="relative">
          <FormInput
            intype="text"
            inname="dropdown"
            value={opt.label}
            inlabel={"Dropdown option " + i}
            onChange={(e) => updateOption(i, e.target.value)}
            className="min-h-12!"
          />
          <button
            type="button"
            onClick={() => removeOption(i)}
            className="absolute right-4 top-3"
          >
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
