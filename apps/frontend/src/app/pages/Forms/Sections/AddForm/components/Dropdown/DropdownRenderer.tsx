import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import { FormField } from "@/app/types/forms";
import React, { useMemo } from "react";

const DropdownRenderer: React.FC<{
  field: FormField & { type: "dropdown" | "radio" | "checkbox" };
  value: any;
  onChange: (v: any) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => {
  const isReadOnly = readOnly || (field as any).meta?.readonly;
  const defaultValue = (field as any).defaultValue;
  const displayValue = value ?? defaultValue;

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
    if (Array.isArray(displayValue)) {
      selected = displayValue;
    } else if (displayValue) {
      selected = [displayValue];
    }
    const toggle = (optValue: string) => {
      if (isReadOnly) return;
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
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center space-x-2 text-body-3 text-text-primary"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 align-middle"
                disabled={isReadOnly}
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span className="leading-none pl-2 translate-y-[1px] inline-block">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "radio") {
    const selected = typeof displayValue === "string" ? displayValue : "";
    return (
      <div className="flex flex-col gap-2">
        <div className="font-grotesk text-black-text text-[16px] font-medium">
          {field.label}
        </div>
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center space-x-2 text-body-3 text-text-primary"
            >
              <input
                type="radio"
                className="h-4 w-4 shrink-0 align-middle"
                name={field.id}
                disabled={isReadOnly}
                checked={selected === opt.value}
                onChange={() => !isReadOnly && onChange(opt.value)}
              />
              <span className="leading-none pl-2 translate-y-[1px] inline-block">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Dropdown
        placeholder={field.label || ""}
        value={displayValue}
        onChange={(e) => !isReadOnly && onChange(e)}
        className="min-h-12!"
        dropdownClassName="top-[55px]! !h-fit max-h-[200px]!"
        disabled={isReadOnly}
        options={options.map((opt) => ({
          label: opt.label,
          value: opt.value,
        }))}
      />
    </div>
  );
};

export default DropdownRenderer;
