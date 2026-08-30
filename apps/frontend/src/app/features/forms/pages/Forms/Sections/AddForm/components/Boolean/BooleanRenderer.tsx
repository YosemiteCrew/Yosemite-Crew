import React from 'react';
import { FormField } from '@/app/features/forms/types/forms';

const BooleanRenderer: React.FC<{
  field: FormField & { type: 'boolean' };
  value: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => (
  <div className="flex items-center gap-3">
    <input
      type="checkbox"
      id={field.id}
      aria-label={field.label}
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
      disabled={readOnly}
      /* `shrink-0`: the row is a flex line and the label is the flexible sibling,
         so without it the CHECKBOX gave up its width once the label stopped
         fitting - measured 8.9px wide against its full 20px height in a 260px
         column, which is most of a phone form. The text wraps instead. */
      className="size-5 shrink-0 accent-blue-text"
    />
    <label htmlFor={field.id} className="font-satoshi text-black-text text-[16px] font-medium">
      {field.label}
    </label>
  </div>
);

export default BooleanRenderer;
