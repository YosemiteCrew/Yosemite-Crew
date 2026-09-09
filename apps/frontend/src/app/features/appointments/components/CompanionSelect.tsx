import React from 'react';
import { panelFieldLabelClass, panelInputClass } from '@/app/ui/primitives/PanelStates/PanelStates';

export type CompanionSelectOption = {
  id: string;
  name: string;
  ownerName?: string;
};

/**
 * The companion picker shared by the appointment panels that put a patient on a
 * list (the waitlist and the check-in board). Each panel names the same control
 * differently - "Companion" on the waitlist, "Patient" at the front desk - so
 * the wording is passed in while the markup stays one definition.
 */
export const CompanionSelect = ({
  id,
  label,
  placeholder,
  emptyLabel,
  value,
  onChange,
  companions,
}: {
  /** Omitted by panels whose label already wraps the control. */
  id?: string;
  label: string;
  placeholder: string;
  /** Shown in place of the placeholder when there is nothing to pick. */
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  companions: CompanionSelectOption[];
}) => (
  <label className="flex flex-col gap-1" htmlFor={id}>
    <span className={panelFieldLabelClass}>{label}</span>
    <select
      id={id}
      className={panelInputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={companions.length === 0}
    >
      <option value="">{companions.length === 0 ? emptyLabel : placeholder}</option>
      {companions.map((companion) => (
        <option key={companion.id} value={companion.id}>
          {companion.ownerName ? `${companion.name} — ${companion.ownerName}` : companion.name}
        </option>
      ))}
    </select>
  </label>
);
