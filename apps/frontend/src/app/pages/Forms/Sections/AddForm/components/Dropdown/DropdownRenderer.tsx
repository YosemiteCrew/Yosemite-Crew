import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import { DropdownField } from "@/app/types/forms";
import React from "react";

const DropdownRenderer: React.FC<{
  field: DropdownField;
  value: string;
  onChange: (v: string) => void;
}> = ({ field, value, onChange }) => {
  const hasValidOptions = field.options?.some((opt) => opt.trim() !== "");

  if (!hasValidOptions) {
    return null;
  }
  
  return (
    <div className="flex flex-col gap-3">
      <Dropdown
        placeholder={field.label || ""}
        value={value}
        onChange={(e) => onChange(e)}
        className="min-h-12!"
        dropdownClassName="top-[55px]! !h-fit"
        options={field.options || []}
      />
    </div>
  );
};

export default DropdownRenderer;
