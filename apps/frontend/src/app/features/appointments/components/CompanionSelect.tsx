import React, { useMemo } from 'react';
import { panelFieldLabelClass } from '@/app/ui/primitives/PanelStates/PanelStates';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import type { DropdownOption } from '@/app/hooks/useDropdown';

export type CompanionSelectOption = {
  id: string;
  name: string;
  ownerName?: string;
};

const toDropdownOption = (companion: CompanionSelectOption): DropdownOption => ({
  value: companion.id,
  label: companion.ownerName ? `${companion.name} — ${companion.ownerName}` : companion.name,
});

/**
 * The companion picker shared by the appointment panels that put a patient on a
 * list (the waitlist and the check-in board). Each panel names the same control
 * differently - "Companion" on the waitlist, "Patient" at the front desk - so
 * the wording is passed in while the markup stays one definition.
 *
 * This was a native `<select>`. Its closed state took the app's field styling,
 * but the open option list is browser chrome - no CSS reaches an `<option>`'s
 * font, radius, or hover colour in any engine - so it rendered as a plain OS
 * list dropped over the app the moment a clinic opened it, on a form that can
 * carry a hundred-plus patients with no way to filter them. `LabelDropdown` is
 * the searchable combobox every other picker in this app already uses (see
 * TaskAssigneeSelect): a real, styled option list, and typing narrows it
 * instead of scrolling it.
 */
export const CompanionSelect = ({
  label,
  placeholder,
  emptyLabel,
  value,
  onChange,
  companions,
}: {
  label: string;
  placeholder: string;
  /** Shown in place of the placeholder when there is nothing to pick. */
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  companions: CompanionSelectOption[];
}) => {
  const options = useMemo(() => companions.map(toDropdownOption), [companions]);
  const hasCompanions = companions.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <span className={panelFieldLabelClass}>{label}</span>
      <LabelDropdown
        placeholder={label}
        hideLabel
        options={options}
        defaultOption={value || undefined}
        onSelect={(option) => onChange(option.value)}
        emptyLabel={hasCompanions ? placeholder : emptyLabel}
        disabled={!hasCompanions}
      />
    </div>
  );
};
