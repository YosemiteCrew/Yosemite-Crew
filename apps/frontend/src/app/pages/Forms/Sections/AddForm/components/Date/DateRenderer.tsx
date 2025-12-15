import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { FormField } from "@/app/types/forms";
import React from "react";

const DateRenderer: React.FC<{
  field: FormField & { type: "date" };
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => (
  <div className="flex flex-col gap-3">
    <FormInput
      intype="date"
      inname={field.id}
      value={value}
      inlabel={field.label || "Date"}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-12!"
      readonly={readOnly}
      onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
        if (readOnly) e.target.blur();
      }}
      onClick={(e: React.MouseEvent<HTMLInputElement>) => {
        if (readOnly) {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      tabIndex={readOnly ? -1 : undefined}
    />
  </div>
);

export default DateRenderer;
