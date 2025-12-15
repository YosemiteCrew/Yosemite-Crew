import React from "react";
import { FormField } from "@/app/types/forms";

const BooleanRenderer: React.FC<{
  field: FormField & { type: "boolean" };
  value: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => (
  <div className="flex items-center gap-3">
    <input
      type="checkbox"
      id={field.id}
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
      disabled={readOnly}
      className="w-5 h-5 accent-blue-text"
    />
    <label
      htmlFor={field.id}
      className="font-grotesk text-black-text text-[16px] font-medium"
    >
      {field.label}
    </label>
  </div>
);

export default BooleanRenderer;
