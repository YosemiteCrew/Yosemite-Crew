import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { FormField } from '@/app/features/forms/types/forms';
import React, { useId, useMemo } from 'react';

const DropdownRenderer: React.FC<{
  field: FormField & { type: 'dropdown' | 'radio' | 'checkbox' };
  value: any;
  onChange: (v: any) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly = false }) => {
  const isReadOnly = readOnly || (field as any).meta?.readonly;
  const defaultValue = (field as any).defaultValue;
  const displayValue = value ?? defaultValue;

  const options = useMemo(() => field.options ?? [], [field.options]);
  const hasValidOptions = options?.length > 0;
  /* Names the group in the radio/checkbox branches. Generated rather than derived
     from `field.id` because two renderers mounted for the same field would then
     emit the same DOM id and aria-labelledby would resolve to whichever came
     first - the trap the shared radio `name` already has. */
  const labelId = useId();

  if (!hasValidOptions) {
    return null;
  }

  if (field.type === 'checkbox') {
    let selected: string[] = [];
    if (Array.isArray(displayValue)) {
      selected = displayValue;
    } else if (displayValue) {
      selected = [displayValue];
    }
    const selectedSet = new Set(selected);
    const toggle = (optValue: string) => {
      if (isReadOnly) return;
      const isSelected = selectedSet.has(optValue);
      const next = isSelected
        ? selected.filter((v: string) => v !== optValue)
        : [...selected, optValue];
      onChange(next);
    };

    return (
      <div className="flex flex-col gap-2">
        <div id={labelId} className="font-satoshi text-black-text text-[16px] font-medium">
          {field.label}
        </div>
        {/* The question is a plain div, so without a group role a screen reader
            reads loose checkboxes and never announces what is being asked - the
            composed aria-label on each input was carrying the whole question by
            itself. role + aria-labelledby adds the grouping without a fieldset,
            which would change the layout this label div already owns. */}
        <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center gap-x-2 text-body-3 text-text-primary"
            >
              <input
                type="checkbox"
                aria-label={`${field.label}: ${opt.label}`}
                className="size-4 shrink-0 align-middle"
                disabled={isReadOnly}
                checked={selectedSet.has(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span className="leading-none pl-2 translate-y-[1px] inline-block">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'radio') {
    const selected = typeof displayValue === 'string' ? displayValue : '';
    return (
      <div className="flex flex-col gap-2">
        <div id={labelId} className="font-satoshi text-black-text text-[16px] font-medium">
          {field.label}
        </div>
        {/* Same reason as the checkbox branch, and a shared `name` is not a
            substitute: it makes the radios exclusive but announces nothing, so
            the group was read as loose radios with no question attached. */}
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="inline-flex items-center gap-x-2 text-body-3 text-text-primary"
            >
              <input
                type="radio"
                aria-label={`${field.label}: ${opt.label}`}
                className="size-4 shrink-0 align-middle"
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
      <LabelDropdown
        placeholder={field.label || ''}
        defaultOption={displayValue ?? ''}
        /* Guarding only `onSelect` was not enough: LabelDropdown holds its own
           selected label, so a read-only field still opened and still moved its
           visible answer while onChange never fired - the preview then showed a
           value the record did not contain. The radio and checkbox branches
           below already disable their inputs; this makes the select match. */
        disabled={isReadOnly}
        onSelect={(option) => !isReadOnly && onChange(option.value)}
        options={options.map((opt) => ({
          label: opt.label,
          value: opt.value,
        }))}
      />
    </div>
  );
};

export default DropdownRenderer;
