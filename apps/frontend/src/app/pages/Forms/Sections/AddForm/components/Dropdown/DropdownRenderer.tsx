import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import { FormField } from "@/app/types/forms";
import React, { useMemo } from "react";

const DropdownRenderer: React.FC<{
  field: FormField & { type: "dropdown" | "radio" | "checkbox" };
  value: any;
  onChange: (v: any) => void;
}> = ({ field, value, onChange }) => {
  const options = useMemo(
    () => field.options ?? [],
    [field.options]
  );
  const hasValidOptions = options?.length > 0;

  if (!hasValidOptions) {
    return null;
  }

  if (field.type === "checkbox") {
    let selected: string[] = [];
    if (Array.isArray(value)) {
      selected = value;
    } else if (value) {
      selected = [value];
    }
    const toggle = (optValue: string) => {
      const isSelected = selected.includes(optValue);
      const next = isSelected
        ? selected.filter((v: string) => v !== optValue)
        : [...selected, optValue];
      onChange(next);
    };

    return (
      <div className="flex flex-col gap-2">
        <div className="font-grotesk text-black-text text-[16px] font-medium">
          {field.label}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`px-3 py-2 rounded-2xl border ${selected.includes(opt.value) ? "border-blue-text bg-blue-light text-blue-text" : "border-grey-light"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "radio") {
    const selected = typeof value === "string" ? value : "";
    return (
      <div className="flex flex-col gap-2">
        <div className="font-grotesk text-black-text text-[16px] font-medium">
          {field.label}
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-2 rounded-2xl border ${selected === opt.value ? "border-blue-text bg-blue-light text-blue-text" : "border-grey-light"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Dropdown
        placeholder={field.label || ""}
        value={value}
        onChange={(e) => onChange(e)}
        className="min-h-12!"
        dropdownClassName="top-[55px]! !h-fit"
        options={options.map((opt) => ({
          label: opt.label,
          value: opt.value,
        }))}
      />
    </div>
  );
};

export default DropdownRenderer;
